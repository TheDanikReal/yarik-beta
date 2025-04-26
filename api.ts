import * as http from "node:http"
import { startBot, bot, logger } from "./index.ts"

interface DiscordStatus {
    page: {
        id: string,
        name: string,
        url: string,
        time_zone: string,
        updated_at: string
    },
    status: {
        indicator: string,
        description: string
    }
}

async function fetchDiscordStatus() {
    const response = await fetch(url)
    const status = await response.json() as DiscordStatus
    discordStatus = status.status?.indicator == "none"
    return
}

startBot()

logger.info("started")

const port = process.env.PORT || 3000
const url = process.env.STATUS_URL || "https://discordstatus.com/api/v2/status.json"
let discordStatusRefreshed = Date.now()
let discordStatus = false
fetchDiscordStatus()

const server = http.createServer(async (req, res) => {
    if (discordStatusRefreshed <= Date.now() - 1000 * 60 * 30) {
        await fetchDiscordStatus()
        console.log("refreshed status")
        discordStatusRefreshed = Date.now()
    }
    if (req.url == "/") {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(`{ status: ${bot.isReady()}, discordStatus: ${discordStatus} }`)
    }
})

server.listen(port, () => {
    logger.info("server is running on port ", port, " ")
})