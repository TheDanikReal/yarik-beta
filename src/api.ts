import * as http from "node:http"
import { settings } from "./settings.ts"
import { bot, logger, startBot } from "./index.ts"
import console from "node:console"
import process from "node:process"
import { setTimeout } from "node:timers"

interface DiscordStatus {
    page: {
        id: string
        name: string
        url: string
        "time_zone": string
        "updated_at": string
    }
    status: {
        indicator: string
        description: string
    }
}

async function fetchDiscordStatus() {
    try {
        const response = await fetch(url)
        const status = await response.json() as DiscordStatus
        discordStatus = status.status?.indicator === "none"
    } catch (_err) {
        discordStatus = false
    }
    return
}

async function cacheMessage() {
    if (discordStatusRefreshed <= Date.now() - 1000 * 60 * settings.statusCooldown) {
        await fetchDiscordStatus()
        console.log("refreshed status")
        discordStatusRefreshed = Date.now()
    }
    cachedMessage = `{ "status": "${bot.isReady()}", "discordStatus": "${discordStatus}" }`
    cached = true
    setTimeout(() => {
        cached = false
    }, 5000)
}

startBot()

logger.info("started")

const port = process.env.PORT || 3000
const url = process.env.STATUS_URL || "https://discordstatus.com/api/v2/status.json"
let cached = false
let cachedMessage = ""
let discordStatusRefreshed = Date.now()
let discordStatus = false
fetchDiscordStatus()

const server = http.createServer(async (req, res) => {
    if (req.url === "/") {
        res.writeHead(200, { "content-type": "application/json" })
        if (!cached) await cacheMessage()
        res.end(cachedMessage)
    }
    return
})

server.listen(port, () => {
    logger.info(`server is running on port ${port}`)
})
