import { REST, Routes, type RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js"
import { commands } from "./slash.ts"
import "dotenv/config"

if (!process.env.TOKEN) {
    throw new Error("token is not set in .env")
}

const rest = new REST().setToken(process.env.TOKEN)

const requestData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = []

for (let command of commands) {
    requestData.push(command.data.toJSON())
}

const data = await rest.put(
    Routes.applicationCommands("999592529513156629"),
    { body: requestData },
)


console.log("done")