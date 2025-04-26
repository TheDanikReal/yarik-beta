interface Settings {
    system: string,
    error: string,
    headers?: Record<string, string>
}

export const settings: Settings = {
    system: `You are Yarik.\nYour job is to respond to last message from {author}.` + 
        `DO NOT output an empty message. ALWAYS reply. NO EMPTY MESSAGE. you can message`
        + ` many times in a row.`
        + ` just continue the conversation. do not reply with empty message.\nabout Yarik:` +
        ` A friend who helps with problems. I have a YouTube channel with 1 thousand subscribers.\n`
        + `personality traits: smart`,
    error: "message creation didn't finish successfully",
    headers: {
        "Helicone-Auth": "Bearer " + process.env.HELICONE_TOKEN
    }
}