import type { ButtonInteraction, CacheType } from "discord.js"
import console from "node:console"
import { promises as fs } from "node:fs"
import { serialize } from "node:v8"
import { userData } from "./index.ts"

export async function saveData(interaction: ButtonInteraction<CacheType>) {
    await fs.writeFile("users.db", serialize(userData))
    console.log(userData)
    interaction.reply("saved data")
}
