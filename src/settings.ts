import process from "node:process"

interface Settings {
    system: string
    error: string
    ignorePrefix: string
    headers?: Record<string, string>
    statusCooldown: number
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
    statusCooldown: 5
}