import { Client, Events, GatewayIntentBits, SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction, type OmitPartialGroupDMChannel, Message, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, type GuildTextBasedChannel, type Snowflake } from "discord.js"
import { buttonCommandHandler, commmandHandler, contextMenuHandler, slashCommandHandler } from "./commands.ts"
import type { ChatCompletionMessageParam, CompletionUsage } from "openai/resources/index.mjs"
import { tools, toolDescriptions, type Tools } from "./tools.ts"
import { fileURLToPath } from "node:url"
import { LRUCache } from "lru-cache"
import { pino } from "pino"
import OpenAI from "openai"
import "dotenv/config"
import { database } from "./base.ts"
import { settings } from "./settings.ts"

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

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
})
export const bot = new Client({ intents: [GatewayIntentBits.Guilds, "MessageContent", "GuildMessages", "DirectMessages"]})
const openaiClient = new OpenAI({ apiKey: process.env.API_TOKEN,
    baseURL: process.env.API_ENDPOINT,
    defaultHeaders: settings.headers })
const models = new Map<string, OpenAI>()
export const cacheSize = Number(process.env.CACHE_SIZE) || 10
export const modalFetchSize = 10
export const fetchSize = Math.min(cacheSize, 100)
let modelsCount = 0

let previousModel: OpenAI = openaiClient

for (let i = 1; i < 10; i++) {
    const token = process.env["API_TOKEN" + i]
    const endpoint = process.env["API_ENDPOINT" + i]
    const model = process.env["MODEL_NAME" + i]
    if (token && endpoint && model) {
        logger.info("found " + model)
        const client = new OpenAI({ baseURL: endpoint, apiKey: token, defaultHeaders: settings.headers })
        models.set(model, client)
        previousModel = client
    } else if (model) {
        models.set(model, previousModel)
        logger.info("found model " + model + " from cache")
    } else {
        modelsCount = i
        logger.info("found " + i + " api tokens")
        break
    }
}

models.set(process.env["MODEL_NAME"], openaiClient)

export let guildCache: GuildCache = {}
export let slashCommands = new Map<string, SlashCommand>()
export let userData = new Map<string, UserData>()

export async function fetchMessages(size: number, channel: GuildTextBasedChannel, target: string) {
    const messages = await channel.messages.fetch({ limit: Math.min(fetchSize, size) })
        logger.debug("target: " + target)
        logger.debug("size: " + size)
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
    console.log(Math.ceil(str.length / 2000))
    for (let i = 0; i < Math.ceil(str.length / 2000); i++) {
        answers.push(str.slice(i * 2000, (i + 1) * 2000))
    }
    console.log(answers.length)
    return await fixMarkup(answers)
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
    return messages // await fixMarkup(messages)
}

export async function fixMarkup(messages: string[]): Promise<string[]> {
    let result: string[] = []
    let active = false
    for (let i = 0; i < messages.length; i++) {
        let editedMessage = messages[i]
        if (active) {
            active = false
            editedMessage = "```" + editedMessage
        }
        if (editedMessage.split("```").length % 2 != 0) {
            active = true
        }
        result.push(editedMessage)
    }
    console.log(result.length)
    return result
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

export async function getModelInfo(model: string) {
    const client = openaiClient
    return await client.models.retrieve(model)
}

export async function startBot(): Promise<boolean> {
    try {
        bot.login(process.env.TOKEN)
        return true
    } catch {
        return false
    }
}

export async function generateCache(channelId: string) {
    if (!guildCache[channelId]) {
        guildCache[channelId] = new LRUCache({
            max: cacheSize
        })
        logger.info("created new cache map for " + channelId)
    }
    return guildCache[channelId]
}

export async function generateAnswer(message: OmitPartialGroupDMChannel<Message<boolean>>) {
    const cache = await generateCache(message.channelId)
    const preferences = await getClient(message.author.id)
    const client = preferences[0]
    const model = preferences[1]
    let content = message.content
    let referenceInfo = ""

    if (message.reference) {
        const reference = await message.fetchReference()
        referenceInfo = reference.content
        content += `\nreplying to message by ${reference.author}: ${referenceInfo}`
    }

    cache.set(message.id, { role: "user", 
        content: message.content + "\nauthor: " + message.author.displayName })

    const request: OpenAICompatibleMessage[] = []
    for (let entry of cache.entries()) {
        request.push(entry[1])
    }

    request.push({ role: "system",
        content: settings.system.replace("{author}", message.author.displayName) })
    request.reverse()
    message.channel.sendTyping()
    const sendTyping = setInterval(() => message.channel.sendTyping(), 5000)
    try {
        let stream = await client.chat.completions.create({
            stream: true,
            stream_options: { include_usage: true },
            messages: request,
            temperature: 1.0,
            top_p: 1.0,
            model: model,
            //tools: toolDescriptions,
            //tool_choice: "auto"
        })
        let i = 1
        let response = ""
        let fullResponse = ""
        let finishReason = ""
        let usage: CompletionUsage
        for await (const part of stream) {
            let chunk = part.choices[0]?.delta?.content || ""
            logger.trace(chunk)
            response += chunk
            fullResponse += chunk
            if (response.length > 1000) {
                let paged = await linePage(response)
                if (!paged) return
                for (let chunk of paged) {
                    if (i == 1) {
                        message.reply(chunk)
                    } else {
                        message.channel.send(chunk)
                    }
                }
                response = ""
                i++
            }
            if (part.usage) {
                usage = part.usage
            }
            if (part.choices[0].finish_reason) {
                finishReason = part.choices[0].finish_reason
            }
        }
        /*if (response.choices[0].finish_reason == "tool_calls") {
            response = await handleTools(message, client, response.choices[0])
        }*/
        let additionalData = `-# ${usage.total_tokens} tokens used with ${finishReason} end reason`
        if (message.attachments.size) {
            additionalData += ", attachments were ignored"
        }
        const answer = response + "\n" + additionalData
        let reply: Message<boolean>
        if (answer.length / 2000 >= 1) {
            let messages = await linePage(answer)
            if (!messages) {
                messages = await simplePage(answer)
            }
            reply = await message.channel.send(messages[0])
            for (let i = 1; i < messages.length; i++) {
                const pagedMessage = messages[i]
                await message.channel.send(pagedMessage)
            }
            cache.set(reply.id, { role: "assistant", 
                content: fullResponse })
            return
        }
        if (i == 1) {
            reply = await message.channel.send(answer)
        }
        cache.set(reply.id, { role: "assistant", 
            content: fullResponse })
    } catch (err) {
        message.reply(settings.error)
        logger.error(err)
    }
    clearInterval(sendTyping)
    return
}

export async function generateResponse(messages: OpenAICompatibleMessage[], userClient?: OpenAI,
    userModel?: string
) {
    let client: OpenAI
    let model: string
    if (!userClient && !userModel) {
        client = openaiClient
        model = process.env.MODEL_NAME
        logger.debug("user settings are not defined")
    } else {
        client = userClient
        model = userModel
        logger.debug("settings are defined")
    }
    logger.trace("using " + model + " model")
    try {
        return client.chat.completions.create({
            messages: messages,
            model: model,
            top_p: 1.0,
            temperature: 1.0
        })
    } catch (err) {
        return false
    }
}

export async function generateAdditionalInfo(message: Message) {
    return message.cleanContent + "\nauthor: " + message.author.globalName
}

export async function getClient(user: string): Promise<[OpenAI, string]> {
    const userData = await database.findUser(user)
    const model = userData?.model
    const userClient = models.get(model)
    if (userClient) {
        logger.trace("model for " + user + "found: " + model)
        return [userClient, model]
    } else {
        logger.trace("model for " + user + " not found")
        return [openaiClient, process.env.MODEL_NAME]
    }
}

async function generateRequest(channelId: string, author: string): Promise<OpenAICompatibleMessage[]> {
    const request: OpenAICompatibleMessage[] = []
    for (let entry of guildCache[channelId].entries()) {
        request.push(entry[1])
        logger.trace(entry[0] + ": " + entry[1].content)
    }
    request.push({ role: "system", content: settings.system.replace("{user}", author) })
    request.reverse()
    return request
}

bot.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) {
        return
    }
    if (message.content.includes(bot.user.id)) {
        if (commmandHandler(message)) {
            return
        }
    }
    const channel = await database.findChannel(message.channelId)
    if (channel?.enabled) {
        generateAnswer(message)
    }
})

bot.on(Events.MessageDelete, async (message) => {
    const cache = guildCache[message.channelId]
    const entry = cache?.get(message.id)
    if (entry) {
        cache.delete(message.id)
    }
})

bot.on(Events.MessageUpdate, async (message) => {
    const cache = guildCache[message.channelId]
    const entry = cache?.get(message.id)
    if (entry) {
        cache.set(message.id, { role: "user", content: message.content })
    }
})

bot.on(Events.InteractionCreate, async (interaction) => {
    logger.trace("got interaction")
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

bot.on("ready", async (ready) => {
    logger.info(ready.user.displayName + " ready")
    logger.info("logged in as " + ready.user.id)
    logger.info("using " + process.env.MODEL_NAME + " model")
})

process.on("SIGINT", async (signal) => {
    console.log("quitting")
    await database.disconnect()
    process.exit(0)
})

if (!process.env.TOKEN) {
    logger.error("bot token is not set")
    process.exit(1)
}

const url = import.meta.url ? import.meta.url : "file:"
let main = false

try {
    main = !!require.main
} catch (err) {
    main = process.argv[1] == fileURLToPath(url)
}

if (main) {
    try {
        bot.login(process.env.TOKEN)
        logger.info("bot is active")
    } catch (err) {
        logger.error(err)
    }
}