import type { APIApplicationCommandOptionChoice, RestOrArray } from "discord.js"
import process from "node:process"

interface Settings {
    system: string
    error: string,
    fallbackAttempt: string,
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
    fallbackAttempt: "message creation didn't finish successfully, retrying with a fallback model",
    ignorePrefix: "@ignore",
    headers: {
        "Helicone-Auth": `Bearer ${process.env.HELICONE_TOKEN}`
    },
    statusCooldown: 5,
    models: [
        { name: "devstral", value: "mistralai/devstral-2512:free" },
        { name: "qwen coder", value: "qwen/qwen3-coder:free" },
        { name: "r1t2 chimera", value: "tngtech/deepseek-r1t2-chimera:free" },
        { name: "gpt oss (120b)", value: "openai/gpt-oss-120b:free" },
        { name: "gpt 4o", value: "gpt-4o" },
        { name: "gpt 4.1", value: "openai/gpt-4.1" },
        { name: "hermes", value: "nousresearch/hermes-3-llama-3.1-405b:free" },
        { name: "xiaomi", value: "xiaomi/mimo-v2-flash:free" },
        { name: "gemini 3.0 flash", value: "gemini-3-flash-preview" }
    ]
}
