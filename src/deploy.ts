import {
    REST,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
    type RESTPostAPIContextMenuApplicationCommandsJSONBody,
    Routes
} from "discord.js"
import { commands } from "./slash.ts"
import "dotenv/config"
import { logger } from "./index.ts"
import process from "node:process"

type InteractionRequestData =
    | RESTPostAPIChatInputApplicationCommandsJSONBody
    | RESTPostAPIContextMenuApplicationCommandsJSONBody

if (!process.env.TOKEN) {
    throw new Error("token is not set in .env")
}

const rest = new REST().setToken(process.env.TOKEN)

const requestData: InteractionRequestData[] = []

for (const command of commands) {
    logger.info(`adding command ${command.data.name} to request`)
    requestData.push(command.data.toJSON())
}

logger.trace(requestData)

const _data = await rest.put(
    Routes.applicationCommands("999592529513156629"),
    { body: requestData }
)

logger.info("deployed commands")
