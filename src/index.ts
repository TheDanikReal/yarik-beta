import type {
    ChatInputCommandInteraction,
    ContextMenuCommandBuilder,
    GuildTextBasedChannel,
    Message,
    MessageContextMenuCommandInteraction,
    OmitPartialGroupDMChannel,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    Snowflake
} from "discord.js"
import type { ChatCompletionMessageParam, CompletionUsage } from "openai/resources/index.mjs"
import console from "node:console"
// import { toolDescriptions, tools } from "./tools.ts"
import process from "node:process"
import { clearInterval, setInterval } from "node:timers"
import { fileURLToPath } from "node:url"
import { ChannelType, Client, Events, GatewayIntentBits, Partials } from "discord.js"
import { LRUCache } from "lru-cache"
import OpenAI from "openai"
import pino from "pino"
import { database } from "./base.ts"
import {
    buttonCommandHandler,
    commmandHandler,
    contextMenuHandler,
    slashCommandHandler
} from "./commands.ts"
import { cacheSize, fetchMaxSize } from "./consts.ts"
import { settings } from "./settings.ts"
import "dotenv/config"

export interface SlashCommand {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>
}

export interface ContextMenu {
    data: ContextMenuCommandBuilder
    execute: (interaction: MessageContextMenuCommandInteraction) => Promise<void>
}

export type Interaction = SlashCommand | ContextMenu

export interface UserData {
    model: "gemini-2.0-pro-exp-02-05" | "gpt-4o" | string
}

export type OpenAICompatibleMessage = ChatCompletionMessageParam

interface GuildCache {
    [guild: string]: LRUCache<string, OpenAICompatibleMessage>
}

// console.log(process.env.API_ENDPOINT, " ", process.env.API_TOKEN)

if (
    !process.env.API_ENDPOINT || !process.env.API_TOKEN ||
    !process.env.TOKEN || !process.env.MODEL_NAME
) {
    console.log("fill .env before launching index.ts")
    process.exit(1)
}

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    base: undefined
})
export const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        "MessageContent",
        "GuildMessages",
        "DirectMessages",
        "DirectMessageTyping"
    ],
    partials: [Partials.Channel]
})
const defaultModel = process.env.MODEL_NAME
const fallbackModel = process.env.FALLBACK_MODEL || undefined
const openaiClient = new OpenAI({
    apiKey: process.env.API_TOKEN,
    baseURL: process.env.API_ENDPOINT,
    defaultHeaders: settings.headers
})
const models = new Map<string, OpenAI>()
let modelsCount = 0

let previousModel: OpenAI = openaiClient

for (let i = 1; i < 10; i++) {
    const token = process.env[`API_TOKEN${i}`]
    const endpoint = process.env[`API_ENDPOINT${i}`]
    const model = process.env[`MODEL_NAME${i}`]
    if (token && endpoint && model) {
        logger.info(`found ${model}`)
        const client = new OpenAI({
            baseURL: endpoint,
            apiKey: token,
            defaultHeaders: settings.headers
        })
        models.set(model, client)
        previousModel = client
    } else if (model) {
        models.set(model, previousModel)
        logger.info(`found model ${model} from cache`)
    } else {
        modelsCount = i
        logger.info(`found ${i} api tokens`)
        break
    }
}

models.set(defaultModel, openaiClient)

export const guildCache: GuildCache = {}
/** @deprecated will be removed in next release */
export const slashCommands = new Map<string, SlashCommand>()
export const userData = new Map<string, UserData>()

export async function fetchMessages(size: number, channel: GuildTextBasedChannel, target: string) {
    const messages = await channel.messages.fetch({ limit: Math.min(fetchMaxSize, size) })
    const request: [OpenAICompatibleMessage, Snowflake][] = []
    // let previousMessage = ""
    // let previousAuthor = ""
    logger.debug(`target: ${target}`)
    logger.debug(`size: ${size}`)
    for (const entry of messages.entries()) {
        //if (entry[1].author.id == previousAuthor) {
        //    previousMessage = entry[1].cleanContent
        //} else {
        //    previousAuthor = entry[1].author.id
        //}
        request.push([{
            role: target === entry[1].author.id ? "assistant" : "user",
            content: entry[1].cleanContent
        }, entry[1].id])
        // guildCache[message.channelId].set()
    }
    for (const entry of request) {
        guildCache[channel.id].set(entry[1], entry[0])
    }
}

/*export async function handleTools(
    message: OmitPartialGroupDMChannel<Message>,
    client: OpenAI,
    answer: OpenAI.Chat.Completions.ChatCompletion.Choice
) {
    const toolCall = answer.message.tool_calls?.[0]
    if (!toolCall) return
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
    console.log(
        "generated image with prompt " + toolCall.function.arguments +
            " with response " + toolResponse
    )
    return await client.chat.completions.create({
        messages: await generateRequest(message.channelId, message.author.displayName),
        tools: toolDescriptions,
        temperature: 1.0,
        top_p: 1.0,
        model: defaultModel
    })
}*/

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
    const answers: string[] = []
    console.log(Math.ceil(str.length / 2000))
    for (let i = 0; i < Math.ceil(str.length / 2000); i++) {
        answers.push(str.slice(i * 2000, (i + 1) * 2000))
    }
    console.log(answers.length)
    return await fixMarkup(answers)
}

export async function linePage(str: string): Promise<string[] | false> {
    const lines = str.split("\n").length
    const messages: string[] = []
    let answer = ""
    let length = 0
    let i = 0
    for (const line of str.split("\n")) {
        i++
        if (Math.floor((line.length + length) / 2000) !== 0) {
            messages.push(answer)
            answer = line
            length = line.length + 3
        } else if (i === lines) {
            messages.push(answer + line)
        } else {
            if (line.length < 2000) {
                answer += `${line}\n`
                length += line.length + 3
            }
        }
    }
    return messages
}

export async function fixMarkup(messages: string[]): Promise<string[]> {
    const result: string[] = []
    let active = false
    for (let i = 0; i < messages.length; i++) {
        let editedMessage = messages[i]
        if (active) {
            active = false
            editedMessage = `\`\`\`${editedMessage}`
        }
        if (editedMessage.split("```").length % 2 !== 0) {
            active = true
        }
        result.push(editedMessage)
    }
    console.log(result.length)
    return result
}

export async function getModels(): Promise<string[]> {
    const result = []
    result.push(defaultModel)
    console.log(modelsCount)
    for (let i = 1; i < modelsCount; i++) {
        console.log(process.env[`MODEL_NAME${i}`])
    }
    console.log(result)
    return result
}

/**
 * @returns an array with first element being client and second is status,
 * model was found or used default client
 */
export async function getModel(model: string): Promise<[OpenAI, boolean]> {
    const userClient = models.get(model)
    if (userClient) {
        return [userClient, true]
    } else {
        return [openaiClient, false]
    }
}

export async function getModelInfo(model: string) {
    const client = openaiClient
    return await client.models.retrieve(model)
}

/**
 * starts bot with TOKEN enviornment variable
 */
export async function startBot(): Promise<boolean> {
    try {
        await bot.login(process.env.TOKEN)
        return true
    } catch {
        return false
    }
}

export async function generateCache(channelId: Snowflake) {
    if (!guildCache[channelId]) {
        guildCache[channelId] = new LRUCache({
            max: cacheSize
        })
        logger.info(`created new cache map for ${channelId}`)
    }
    return guildCache[channelId]
}

export async function generateAnswer(
    message: OmitPartialGroupDMChannel<Message<boolean>>,
    customModel?: string
) {
    if (message.content.startsWith(settings.ignorePrefix)) return

    const cache = await generateCache(message.channelId)
    let client: OpenAI
    let model: string
    if (customModel) {
        const modelInfo =  await getModel(customModel)
        if (modelInfo[1] == false) {
            logger.debug(`cant find a custom model: ${customModel}, using default one`)
        }
        client = modelInfo[0]
        model = customModel
    } else {
        const preferences = await getClient(message.author.id)
        client = preferences[0]
        model = preferences[1]
    }
    let content = message.content
    let referenceInfo = ""

    if (message.reference) {
        const reference = await message.fetchReference()
        referenceInfo = reference.content
        content += `\nreplying to message by ${reference.author}: ${referenceInfo}`
    }

    cache.set(message.id, {
        role: "user",
        content: `${message.author.displayName}: ${content}`
    })

    const request: OpenAICompatibleMessage[] = []
    for (const entry of cache.entries()) {
        request.push(entry[1])
    }

    request.push({
        role: "system",
        content: settings.system.replace("{author}", message.author.displayName)
    })
    request.reverse()
    //message.channel.sendTyping()
    const sendTyping = setInterval(() => message.channel.sendTyping(), 5000)
    try {
        const stream = await client.chat.completions.create({
            stream: true,
            stream_options: { include_usage: true },
            messages: request,
            temperature: 1.0,
            top_p: 1.0,
            model
            //tools: [{ type: "function", function: { name: "google_search" }}],
            //tool_choice: "auto"
        })
        let i = 1
        let response = ""
        let fullResponse = ""
        let finishReason = ""
        let inCodeBlock = false
        let usage: CompletionUsage = {
            // deno-lint-ignore camelcase
            total_tokens: 0,
            // deno-lint-ignore camelcase
            completion_tokens: 0,
            // deno-lint-ignore camelcase
            prompt_tokens: 0
        }
        for await (const part of stream) {
            const chunk = part.choices[0]?.delta?.content || ""
            //logger.trace(chunk)
            response += chunk
            if (response.length > 1000) {
                fullResponse += response
                if ((response.split("```").length - 1) % 2 !== 0) {
                    if (!inCodeBlock) {
                        response += "```"
                        inCodeBlock = true
                    } else {
                        response = `\`\`\`${response}`
                        inCodeBlock = false
                    }
                } else if (inCodeBlock) {
                    response = `\`\`\`${response}\`\`\``
                }
                if (i === 1) {
                    message.reply(response)
                } else {
                    message.channel.send(response)
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
        fullResponse += response
        /*if (response.choices[0].finish_reason == "tool_calls") {
            response = await handleTools(message, client, response.choices[0])
        }*/
        let additionalData = `-# ${usage.total_tokens} tokens used with ${finishReason} end reason`
        if (message.attachments.size) {
            additionalData += ", attachments were ignored"
        }
        if (customModel) {
            additionalData += ", used fallback model"
        }
        const answer = `${response}\n${additionalData}`
        if (answer.length / 2000 >= 1) {
            let messages = await linePage(answer)
            if (!messages) {
                messages = await simplePage(answer)
            }
            const reply = await message.channel.send(messages[0])
            for (let i = 1; i < messages.length; i++) {
                const pagedMessage = messages[i]
                await message.channel.send(pagedMessage)
            }
            cache.set(reply.id, { role: "assistant", content: fullResponse })
            return
        }
        let reply: Message
        if (i === 1) {
            reply = await message.reply(answer)
        } else {
            reply = await message.channel.send(answer)
        }
        cache.set(reply.id, { role: "assistant", content: fullResponse })
    } catch (err) {
        message.reply(settings.error)
        logger.error(err)
    }
    clearInterval(sendTyping)
}

export async function generateResponse(
    messages: OpenAICompatibleMessage[],
    userClient?: OpenAI,
    userModel?: string
) {
    let client: OpenAI
    let model: string
    if (!userClient || !userModel) {
        client = openaiClient
        model = defaultModel
        logger.debug("user settings are not defined")
    } else {
        client = userClient
        model = userModel
        logger.debug("settings are defined")
    }
    logger.trace(`using ${model} model`)
    try {
        return client.chat.completions.create({
            messages,
            model,
            top_p: 1.0,
            temperature: 1.0
        })
    } catch (_err) {
        return false
    }
}

export async function generateAdditionalInfo(message: Message) {
    return `${message.cleanContent}\nauthor: ${message.author.globalName!}`
}

export async function getClient(user: string): Promise<[OpenAI, string]> {
    const userData = await database.findUser(user)
    const model = userData?.model || ""
    const userClient = models.get(model)
    if (userClient) {
        logger.trace(`model for ${user} found: ${model}`)
        return [userClient, model]
    } else {
        logger.trace(`model for ${user} not found`)
        return [openaiClient, defaultModel]
    }
}

async function generateRequest(
    channelId: string,
    author: string
): Promise<OpenAICompatibleMessage[]> {
    const request: OpenAICompatibleMessage[] = []
    for (const entry of guildCache[channelId].entries()) {
        request.push(entry[1])
        logger.trace(`${entry[0]}: ${entry[1].content}`)
    }
    request.push({ role: "system", content: settings.system.replace("{user}", author) })
    request.reverse()
    return request
}

bot.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) {
        return
    }
    if (message.content.includes(bot.user?.id as string)) {
        if (await commmandHandler(message)) {
            return
        }
    }
    const channel = await database.findChannel(message.channelId)
    if (channel?.enabled || message.channel.type === ChannelType.DM) {
        try {
            generateAnswer(message)
        } catch (err) {
            logger.error(err)
            if (!fallbackModel || (await getClient(message.author.id))[1] == fallbackModel) return
            generateAnswer(message, fallbackModel)
        }
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
        cache.set(message.id, { role: "user", content: message.content! })
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

bot.on("clientReady", async (ready) => {
    logger.info(`${ready.user.displayName} ready`)
    logger.info(`logged in as ${ready.user.id}`)
    logger.info(`using ${process.env.MODEL_NAME} model`)
})

process.on("SIGINT", async (_signal) => {
    console.log("quitting")
    await database.disconnect()
    process.exit(0)
})

if (!process.env.TOKEN) {
    logger.error("bot token is not set")
    process.exit(1)
}

const url = (import.meta as { url: string }).url || "file:"
let main = false

try {
    main = !!require.main
} catch (_err) {
    main = process.argv[1] === fileURLToPath(url)
}

if (main) {
    try {
        void startBot()
        logger.info("bot is active")
    } catch (err) {
        logger.error(err)
    }
}
