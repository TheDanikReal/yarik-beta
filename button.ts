import { ButtonInteraction, type CacheType } from "discord.js";
import { enabledChannels, userData } from "./index.ts"
import { promises as fs } from "node:fs"
import { serialize } from "node:v8";

export async function saveData(interaction: ButtonInteraction<CacheType>) {
    await fs.writeFile("servers.db", serialize(enabledChannels))
    await fs.writeFile("users.db", serialize(userData))
    console.log(enabledChannels)
    console.log(userData)
    interaction.reply("saved data")
}