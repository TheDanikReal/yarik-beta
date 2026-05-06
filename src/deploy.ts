import type {
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIContextMenuApplicationCommandsJSONBody
} from "discord.js"
import process from "node:process"
import { REST, Routes } from "discord.js"
import { logger } from "./index.ts"
import { commands as slashCommands } from "./slash.ts"
import { commands as contextCommands } from "./context.ts"
import "dotenv/config"

type InteractionRequestData =
    | RESTPostAPIChatInputApplicationCommandsJSONBody
    | RESTPostAPIContextMenuApplicationCommandsJSONBody

if (!process.env.TOKEN) {
    throw new Error("token is not set in .env")
}

const rest = new REST().setToken(process.env.TOKEN)

const requestData: InteractionRequestData[] = []

for (const command of [...slashCommands, ...contextCommands]) {
    logger.info(`adding command ${command.data.name} to request`)
    requestData.push(command.data.toJSON())
}

logger.trace(requestData)

const _data = await rest.put(
    Routes.applicationCommands("999592529513156629"),
    { body: requestData }
)

logger.info("deployed commands")
