import {
    ActionRowBuilder,
    ButtonBuilder,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type Message,
    type MessageContextMenuCommandInteraction,
    type OmitPartialGroupDMChannel
} from "discord.js"
import { bot, generateAnswer, generateCache, logger, userData } from "./index.ts"
import { saveData } from "./button.ts"
import { clearCache, fetchMessages, generateAnswerAround, infoCommand, setModel } from "./slash.ts"
import { database } from "./base.ts"
import { fetchMaxSize } from "./consts.ts"
import process from "node:process"

export async function contextMenuHandler(interaction: MessageContextMenuCommandInteraction) {
    generateAnswerAround.execute(interaction)
}

export function slashCommandHandler(interaction: ChatInputCommandInteraction) {
    switch (interaction.commandName) {
        case "setmodel":
            setModel.execute(interaction)
            break
        case "clearcache":
            clearCache.execute(interaction)
            break
        case "info":
            infoCommand.execute(interaction)
            break
        case "fetch":
            fetchMessages.execute(interaction)
            break
        default:
            logger.trace(`slash command is not found: ${interaction.commandName}`)
            break
    }
}

export function buttonCommandHandler(interaction: ButtonInteraction) {
    switch (interaction.customId) {
        case "save":
            saveData(interaction)
            break
        default:
            break
    }
}

export async function commmandHandler(message: OmitPartialGroupDMChannel<Message>) {
    if (message.content.includes("save")) {
        const confirm = new ButtonBuilder()
            .setCustomId("save")
            .setLabel("Save data")
            .setStyle(1)
        // const row = new ActionRowBuilder()
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirm)
        await message.reply({
            content: "Click button to confirm saving message",
            components: [row]
        })
        return true
    } else if (message.content.includes("activate")) {
        const user = await message.guild?.members.fetch({ user: message.author.id })
        const manageMessages = user?.permissions.has("ManageMessages")
        if (!manageMessages) {
            message.reply("user must have rights of managing messages")
            return
        }
        const channel = await database.findChannel(message.channelId)
        if (!channel?.enabled) {
            database.editChannelIfExists(message.channelId, true)
            message.reply("added channel")
        } else {
            database.editChannelIfExists(message.channelId, false)
            message.reply("removed channel")
        }
        return true
    } else if (message.content.includes("fetch")) {
        const cache = await generateCache(message.channelId)
        const options = message.content.split(" ")
        if (!options[2]) {
            options[2] = bot.user?.id!
        }
        logger.trace(`generating cache for ${message.channelId}with settings: ${options}`)
        const userSize = Number(options[3]) | fetchMaxSize
        const channel = message.channel
        const messages = await channel.messages.fetch({ limit: Math.min(fetchMaxSize, userSize) })
        const target = options[2]
        logger.trace(`target: ${target}`)
        logger.trace(`size: ${userSize}`)
        const request: Message[] = []
        for (const entry of messages.entries()) {
            request.push(entry[1])
        }
        request.reverse()
        for (const entry of request) {
            cache.set(entry.id, {
                role: target === entry.author.id ? "assistant" : "user",
                content: `${entry.cleanContent}\nauthor: ${entry.author.globalName}`
            })
            process.stdout.write(entry.cleanContent)
        }
        message.reply("fetched messages")
        return true
        //} else if (message.content.includes("clear")) {
        //    database.cacheUsers.clear()
        //    database.cacheChannels.clear()
        //    message.reply("cleared cache")
    } else {
        await generateAnswer(message)
        logger.trace(`generating answer for ${userData.get(message.author.id)}`)
        return false
    }
}
