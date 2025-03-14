import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ChatInputCommandInteraction, Message, MessageContextMenuCommandInteraction, type CacheType, type OmitPartialGroupDMChannel } from "discord.js"
import { enabledChannels, userData, guildCache, cacheSize, bot, type OpenAICompatibleMessage, generateAnswer, modalFetchSize, fetchSize, generateCache } from "./index.ts"
import { saveData } from "./button.ts"
import { generateAnswerAround, setModel } from "./slash.ts"
import { LRUCache } from "lru-cache"
import { database } from "./base.ts"

export async function contextMenuHandler(interaction: MessageContextMenuCommandInteraction) {
    generateAnswerAround.execute(interaction)
}

export function slashCommandHandler(interaction: ChatInputCommandInteraction) {
    switch (interaction.commandName) {
        case "setmodel":
            setModel.execute(interaction)
            break
        default:
            console.log(interaction.commandName)
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
            // enabledChannels.set(message.channelId, true)
            message.reply("added channel")
        } else {
            database.editChannelIfExists(message.channelId, false)
            // enabledChannels.set(message.channelId, false)
            message.reply("removed channel")
        }
        return true
    } else if (message.content.includes("fetch")) {
        const cache = await generateCache(message.channelId)
        let options = message.content.split(" ")
        if (!options[2]) {
           options[2] = bot.user.id
        }
        console.log(options)
        const userSize = Number(options[3]) | fetchSize
        const channel = message.channel
        const messages = await channel.messages.fetch({ limit: Math.min(fetchSize, userSize) })
        const target = options[2]
        console.log("target: " + target)
        console.log("size: " + userSize)
        let request: Message[] = []
        for (let entry of messages.entries()) {
            request.push(entry[1])
            // guildCache[message.channelId].set()
        }
        for (let entry of request) {
            cache.set(entry.id, {
                role: target == entry.author.id ? "assistant" : "user",
                content: entry.cleanContent + "\nauthor: " + entry.author.globalName
            })
        }
        message.reply("fetched messages")
    } else {
        await generateAnswer(message)
        console.log(userData.get(message.author.id))
        console.log(message.content)
        return false
    }
}