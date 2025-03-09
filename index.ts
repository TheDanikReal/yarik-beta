import { Client, Events, GatewayIntentBits, ButtonBuilder, ActionRowBuilder, SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction, type OmitPartialGroupDMChannel, Message, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js"
import { buttonCommandHandler, commmandHandler, contextMenuHandler, slashCommandHandler } from "./commands.ts"
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs"
import { tools, toolDescriptions, type Tools } from "./tools.ts"
import { promises as fs } from "node:fs"
import { fileURLToPath } from "node:url"
import { deserialize } from "node:v8"
import { LRUCache } from "lru-cache"
import OpenAI from "openai"
import "dotenv/config"

export interface SlashCommand {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder,
    execute: (interaction: ChatInputCommandInteraction) => {}
}

export interface ContextMenu {
    data: ContextMenuCommandBuilder,
    execute: (interaction: MessageContextMenuCommandInteraction) => {}
}

export type Interaction = SlashCommand | ContextMenu

export interface UserData {
    model: "gemini-2.0-pro-exp-02-05" | "gpt-4o"
}

export type OpenAICompatibleMessage = ChatCompletionMessageParam

interface GuildCache {
    [guild: string]: LRUCache<string, OpenAICompatibleMessage>
}

// console.log(process.env.API_ENDPOINT, " ", process.env.API_TOKEN)

if (!process.env.API_ENDPOINT || !process.env.API_TOKEN || !process.env.TOKEN) {
    console.log("fill .env before launching index.ts")
    process.exit(1)
}

export const bot = new Client({ intents: [GatewayIntentBits.Guilds, "MessageContent", "GuildMessages", "DirectMessages"]})
const openaiClient = new OpenAI({ apiKey: process.env.API_TOKEN, baseURL: process.env.API_ENDPOINT })
const models = new Map<string, OpenAI>()
export const cacheSize = Number(process.env.CACHE_SIZE) || 10
export const fetchSize = Math.min(cacheSize, 100)
let modelsCount = 0

for (let i = 1; i < 10; i++) {
    const token = process.env["API_TOKEN" + i]
    const endpoint = process.env["API_ENDPOINT" + i]
    const model = process.env["MODEL_NAME" + i]
    if (token && endpoint && model) {
        // console.log(process.env["API_TOKEN" + i])
        models.set(model, new OpenAI({ baseURL: endpoint, apiKey: token }))
    } else {
        modelsCount = i
        console.log("found " + i + " api tokens")
        break
    }
}

models.set(process.env["MODEL_NAME"], openaiClient)

export let guildCache: GuildCache = {}
export let slashCommands = new Map<string, SlashCommand>()
export let enabledChannels = new Map<string, boolean>()
export let userData = new Map<string, UserData>()

try {
    const servers: Map<string, boolean> = deserialize(await fs.readFile("servers.db"))
    enabledChannels = servers
    const data: Map<string, UserData> = deserialize(await fs.readFile("users.db"))
    userData = data
} catch (err) {
    console.log("servers database is not found")
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
            answer = ""
            length = 0
        } else if (i == lines) {
            messages.push(answer + line)
        } else {
            if (line.length < 2000) {
                answer += line + "\n"
                length += line.length + 1
            }
        }
    }
    /*
    for (let line of str.split("\n")) {
        console.log(line)
        if (Math.floor((line.length + length) / 2000) != 0) {
            messages.push(answer)
            answer = ""
            length = 0
        } else {
            if (line.length < 2000) {
                console.log("line length: " + line.length + ", answer: " + answer + "length: "
                    + length
                )
                answer += line + "\n"
                length += line.length + 1
            } else {
                return false
            }
        }
    }*/
    return messages
}

export async function getModels(): Promise<string[]> {
    let result = []
    result.push(process.env.MODEL_NAME)
    console.log(modelsCount)
    for (let i = 1; i < modelsCount; i++) {
        console.log(process.env["MODEL_NAME" + i])
    }
    console.log(result)
    return result
}

export async function startBot(): Promise<boolean> {
    try {
        bot.login(process.env.TOKEN)
        return true
    } catch {
        return false
    }
}

export async function generateAnswer(message: OmitPartialGroupDMChannel<Message<boolean>>) {
    if (!guildCache[message.channelId]) {
        guildCache[message.channelId] = new LRUCache({
            max: cacheSize
        })
        console.log("created new cache map")
    }
    const client = await getClient(message.author.id)
    let content = message.content
    let referenceInfo = ""
    if (message.reference) {
        const reference = await message.fetchReference()
        referenceInfo = reference.content
        content += `\nreplying to message by ${reference.author}: ${referenceInfo}`
    }
    guildCache[message.channelId].set(message.id, { role: "user", 
        content: message.content + "\nauthor: " + message.author.displayName })
    // const request = await generateRequest(message.channelId, message.author.displayName)
    const request: OpenAICompatibleMessage[] = []
    for (let entry of guildCache[message.channelId].entries()) {
        request.push(entry[1])
        // console.log(entry[0] + ": " + entry[1].content)
    }
    // request.push({ role: "system", content: "send human-like messages" })
    request.push({ role: "system", content: `You are Yarik.\nYour job is to respond to last message from ${message.author.displayName}. DO NOT output an empty message. ALWAYS reply. NO EMPTY MESSAGE. you can message many times in a row. just continue the conversation. do not reply with empty message.\nabout Yarik: A friend who helps with problems. I have a YouTube channel with 1 thousand subscribers.\npersonality traits: smart` })
    request.reverse()
    message.channel.sendTyping()
    try {
        let response = await client.chat.completions.create({
            messages: request,
            temperature: 1.0,
            top_p: 1.0,
            model: process.env.MODEL_NAME,
            tools: toolDescriptions,
            tool_choice: "auto"
        })
        if (response.choices[0].finish_reason == "tool_calls") {
            const toolCall = response.choices[0].message.tool_calls[0]
            guildCache[message.channelId].set(message.id, {
                role: "assistant",
                content: response.choices[0].message.content
            })
            const functionName = toolCall.function.name
            const tool = tools[functionName]
            const toolResponse = tool(JSON.parse(toolCall.function.arguments))
            guildCache[message.channelId].set(toolCall.id, {
                tool_call_id: toolCall.id,
                role: "tool",
                content: toolResponse
            })
            response = await client.chat.completions.create({
                messages: await generateRequest(message.channelId, message.author.displayName),
                tools: toolDescriptions,
                temperature: 1.0,
                top_p: 1.0,
                model: process.env.MODEL_NAME
            })
            console.log("generated image with prompt " + toolCall.function.arguments + 
                " with response " + toolResponse)
        }
        let additionalData = `-# ${response.usage.total_tokens} tokens used`
        if (message.attachments.size) {
            additionalData += ", attachments were ignored"
        }
        const answer = response.choices[0].message.content + "\n" + additionalData
        // console.log(request)
        if (answer.length / 2000 >= 1) {
            let messages = await linePage(answer)
            if (!messages) {
                messages = await simplePage(answer)
            }
            let savedId = false
            let reply: OmitPartialGroupDMChannel<Message<boolean>>
            for (let pagedMessage of messages) {
                if (!savedId) {
                    reply = await message.reply({ content: pagedMessage })
                } else {
                    await message.reply(pagedMessage)
                }
            }
            guildCache[message.channelId].set(reply.id, { role: "assistant", 
                content: response.choices[0].message.content})
            return
        }
        const reply = await message.reply(answer)
        guildCache[message.channelId].set(reply.id, { role: "assistant", 
            content: response.choices[0].message.content })
    } catch (err) {
        message.reply("message creation didn't finish successfully")
        console.log(err)
    }
    return
}

async function getClient(user: string): Promise<OpenAI> {
    const model = userData.get(user)?.model || process.env.API_TOKEN
    const userClient = models.get(model)
    if (userClient) {
        // console.log("model found: " + userClient.baseURL)
        return userClient
    } else {
        // console.log("model for " + user + " not found")
        return openaiClient
    }
}

async function generateRequest(channelId: string, author: string): Promise<OpenAICompatibleMessage[]> {
    const request: OpenAICompatibleMessage[] = []
    for (let entry of guildCache[channelId].entries()) {
        request.push(entry[1])
        console.log(entry[0] + ": " + entry[1].content)
    }
    // request.push({ role: "system", content: "send human-like messages" })
    request.push({ role: "system", content: `You are Yarik.\nYour job is to respond to last message from ${author}. You can use other messages for context but don't directly address them. DO NOT output an empty message. ALWAYS reply. NO EMPTY MESSAGE. you can message many times in a row. just continue the conversation. do not reply with empty message.\nabout Yarik: A friend who helps with problems. I have a YouTube channel with 1 thousand subscribers.\npersonality traits: smart` })
    request.reverse()
    return request
}

// const allowedMap = new Map()


bot.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) {
        return
    }
    if (message.content.includes(bot.user.id)) {
        if (commmandHandler(message)) {
            return
        }
    }
    if (enabledChannels.get(message.channelId)) {
        generateAnswer(message)
    }
})

bot.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        slashCommandHandler(interaction)
    }
    if (interaction.isMessageContextMenuCommand()) {
        contextMenuHandler(interaction)
    }
    if (!interaction.isButton()) return
    if (!interaction.isRepliable()) return
    buttonCommandHandler(interaction)
    console.log(interaction.customId)
})

//bot.on("debug", (message) => {
//    console.log(message)
//})

bot.on("ready", (ready) => {
    console.log(ready.user.displayName + " ready")
    console.log("logged in as " + ready.user.id)
})

if (!process.env.TOKEN) {
    console.log("bot token is not set")
    process.exit(1)
}

if (process.argv[1] == fileURLToPath(import.meta.url)) {
    try {
        bot.login(process.env.TOKEN)
        console.log("bot is active")
    } catch (err) {
        console.log(err)
    }
}