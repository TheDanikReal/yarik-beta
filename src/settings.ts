import type { APIApplicationCommandOptionChoice, RestOrArray } from "discord.js"
import process from "node:process"

interface Settings {
    system: string
    error: string
    ignorePrefix: string
    headers?: Record<string, string>
    statusCooldown: number
    models: RestOrArray<APIApplicationCommandOptionChoice<string>>
}

export const settings: Settings = {
    system: `You are Yarik.\nYour job is to respond to last message from {author}.` +
        `DO NOT output an empty message. ALWAYS reply. NO EMPTY MESSAGE.` +
        ` just continue the conversation. do not reply with empty message.\nabout Yarik:` +
        ` A friend who helps with problems. I have a YouTube channel with 1 thousand subscribers.\n` +
        `personality traits: smart`,
    error: "message creation didn't finish successfully",
    ignorePrefix: "@ignore",
    headers: {
        "Helicone-Auth": `Bearer ${process.env.HELICONE_TOKEN}`
    },
    statusCooldown: 5,
    models: [
        { name: "qwq", value: "qwen/qwq-32b:free" },
        { name: "qwen A22B", value: "qwen/qwen3-235b-a22b:free" },
        { name: "r1 (new)", value: "deepseek/deepseek-r1-0528:free" },
        { name: "r1 (old)", value: "deepseek/deepseek-r1:free" },
        { name: "gpt 4o", value: "gpt-4o" },
        { name: "gpt 4.1", value: "openai/gpt-4.1" },
        { name: "gemini 2.5 pro", value: "gemini-2.5-pro" },
        { name: "gemini flash", value: "gemini-2.5-flash-preview-05-20" }
    ]
}
