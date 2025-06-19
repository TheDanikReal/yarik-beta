import { simplePage } from "./index.ts";
import process from "node:process";

const result = await simplePage(`\`\`\`
    async function loadData() {
        try {
            const servers: Map<string, boolean> = deserialize(await fs.readFile("servers.db"))
            enabledChannels = servers
            const data: Map<string, UserData> = deserialize(await fs.readFile("users.db"))
            userData = data
        } catch (err) {
            console.log("servers database is not found")
        }
    }
    
    export async function fetchMessages(size: number, channel: GuildTextBasedChannel, target: string) {
        const messages = await channel.messages.fetch({ limit: Math.min(fetchSize, size) })
            console.log("target: " + target)
            console.log("size: " + size)
            let request: [OpenAICompatibleMessage, Snowflake][] = []
            let previousMessage = ""
            let previousAuthor = ""
            for (let entry of messages.entries()) {
                if (entry[1].author.id == previousAuthor) {
                    previousMessage = entry[1].cleanContent
                } else {
                    previousAuthor = entry[1].author.id
                }
                request.push([{
                    role: target == entry[1].author.id ? "assistant" : "user",
                    content: entry[1].cleanContent
                }, entry[1].id])
                // guildCache[message.channelId].set()
            }
            for (let entry of request) {
                guildCache[channel.id].set(entry[1], entry[0])
            }
    }
    
    export async function handleTools(message: OmitPartialGroupDMChannel<Message<boolean>>, 
        client: OpenAI, answer: OpenAI.Chat.Completions.ChatCompletion.Choice) {
        
        const toolCall = answer.message.tool_calls[0]
        guildCache[message.channelId].set(message.id, {
            role: "assistant",
            content: answer.message.content
        })
        const functionName = toolCall.function.name
        const tool = tools[functionName]
        const toolResponse = tool(JSON.parse(toolCall.function.arguments))
        guildCache[message.channelId].set(toolCall.id, {
            tool_call_id: toolCall.id,
            role: "tool",
            content: toolResponse
        })
        console.log("generated image with prompt " + toolCall.function.arguments + 
            " with response " + toolResponse)
        return await client.chat.completions.create({
            messages: await generateRequest(message.channelId, message.author.displayName),
            tools: toolDescriptions,
            temperature: 1.0,
            top_p: 1.0,
            model: process.env.MODEL_NAME
        })
    }
    
    export async function clearChannelCache(channelId: string): Promise<boolean> {
        const cache = guildCache[channelId]
        if (cache) {
            cache.clear()
            return true
        } else {
            return false
        }
    }
    
    export async function simplePage(str: string): Promise<string[]> {
        let answers: string[] = []
        for (let i = 0; i < Math.ceil(str.length / 2000); i++) {
            answers.push(str.slice(i * 2000, (i + 1) * 2000))
        }
        return answers
    }
    
    export async function linePage(str: string): Promise<string[] | false> {
        const lines = str.split("\n").length
        let messages: string[] = []
        let answer = ""
        let length = 0
        let i = 0
        for (let line of str.split("\n")) {
            i++
            if (Math.floor((line.length + length) / 2000) != 0) {
                messages.push(answer)
                answer = line
                length = line.length + 3
            } else if (i == lines) {
                messages.push(answer + line)
            } else {
                if (line.length < 2000) {
                    answer += line + "\n"
                    length += line.length + 3
                }
            }
        }
        return await fixMarkup(messages)
    }\`\`\``)
if (!result) {
    process.exit(1)
}

/*import * as cache from "lru-cache"

const lru = new cache.LRUCache({
    ttl: 10000,
    max: 10
})
for (let i = 0; i < 20; i++) {
    lru.set(i, i.toString())
}
const entries = lru.entries()
console.log(entries)

for (let entry of entries) {
    console.log(entry)
}*/