import { REST, Routes, type RESTPostAPIChatInputApplicationCommandsJSONBody, type RESTPostAPIContextMenuApplicationCommandsJSONBody } from "discord.js"
import { commands } from "./slash.ts"
import "dotenv/config"

type InteractionRequestData = RESTPostAPIChatInputApplicationCommandsJSONBody
| RESTPostAPIContextMenuApplicationCommandsJSONBody

if (!process.env.TOKEN) {
    throw new Error("token is not set in .env")
}

const rest = new REST().setToken(process.env.TOKEN)

const requestData: InteractionRequestData[] = []

for (let command of commands) {
    requestData.push(command.data.toJSON())
}

const data = await rest.put(
    Routes.applicationCommands("999592529513156629"),
    { body: requestData },
)


console.log("done")