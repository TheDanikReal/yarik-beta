import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ChatInputCommandInteraction, Message, MessageContextMenuCommandInteraction, type CacheType, type OmitPartialGroupDMChannel } from "discord.js"
import { enabledChannels, userData, bot, generateAnswer, fetchSize, generateCache, logger, } from "./index.ts"
import { saveData } from "./button.ts"
import { clearCache, generateAnswerAround, setModel } from "./slash.ts"
import { database } from "./base.ts"

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
        default:
            logger.trace("slash command is not found: " + interaction.commandName)
            break
    }
}

export function buttonCommandHandler(interaction: ButtonInteraction<CacheType>) {
    switch (interaction.customId) {
        case "save":
            saveData(interaction)
        default:
            break
    }
}

export async function commmandHandler(message: OmitPartialGroupDMChannel<Message<boolean>>) {
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
        const user = await message.guild.members.fetch({ user: message.author.id })
        const manageMessages = user.permissions.has("ManageMessages")
        if (!manageMessages) {
            message.reply("user must have rights of managing messages")
            return
        }
        const channel = await database.findChannel(message.channelId)
        if (!enabledChannels.get(message.channelId) || !channel?.enabled) {
            database.editChannelIfExists(message.channelId, true)
            message.reply("added channel")
        } else {
            database.editChannelIfExists(message.channelId, false)
            message.reply("removed channel")
        }
        return true
    } else if (message.content.includes("fetch")) {
        const cache = await generateCache(message.channelId)
        let options = message.content.split(" ")
        if (!options[2]) {
           options[2] = bot.user.id
        }
        logger.trace("generating cache for " + message.channelId + "with settings: " + options)
        const userSize = Number(options[3]) | fetchSize
        const channel = message.channel
        const messages = await channel.messages.fetch({ limit: Math.min(fetchSize, userSize) })
        const target = options[2]
        logger.trace("target: " + target)
        logger.trace("size: " + userSize)
        let request: Message[] = []
        for (let entry of messages.entries()) {
            request.push(entry[1])
        }
        request.reverse()
        for (let entry of request) {
            cache.set(entry.id, {
                role: target == entry.author.id ? "assistant" : "user",
                content: entry.cleanContent + "\nauthor: " + entry.author.globalName
            })
            process.stdout.write(entry.cleanContent)
        }
        message.reply("fetched messages")
        return true
    } else {
        await generateAnswer(message)
        logger.trace("generating answer for " + userData.get(message.author.id))
        return false
    }
}