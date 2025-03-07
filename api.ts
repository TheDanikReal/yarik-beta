import * as http from "node:http"
import { startBot, bot } from "./index.ts"

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
    const response = await fetch("https://discordstatus.com/api/v2/status.json")
    const status = await response.json() as DiscordStatus
    discordStatus = status.status.indicator == "none"
    return
}

startBot()

console.log("started")

const port = process.env.PORT || 3000
let discordStatusRefreshed = Date.now()
let discordStatus = false
await fetchDiscordStatus()

const server = http.createServer(async (req, res) => {
    if (discordStatusRefreshed <= Date.now() - 1000 * 60 * 30) {
        await fetchDiscordStatus()
        discordStatusRefreshed = Date.now()
    }
    if (req.url == "/") {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(`{ status: ${bot.isReady()}, discordStatus: ${discordStatus} }`)
    }
})

server.listen(port, () => {
    console.log("server is running on port ", port, " ")
})