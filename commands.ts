import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ChatInputCommandInteraction, Message, type CacheType, type OmitPartialGroupDMChannel } from "discord.js"
import { enabledChannels, userData, guildCache, cacheSize, bot, type OpenAICompatibleMessage } from "./index.ts"
import { saveData } from "./button.ts"
import { setModel } from "./slash.ts"
import { LRUCache } from "lru-cache"

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
        if (!enabledChannels.get(message.channelId)) {
            enabledChannels.set(message.channelId, true)
            message.reply("added channel")
        } else {
            enabledChannels.set(message.channelId, false)
            message.reply("removed channel")
        }
        return true
    } else if (message.content.includes("fetch")) {
        console.log(message.content.split(" "))
        if (!guildCache[message.channelId]) {
            guildCache[message.channelId] = new LRUCache({
                max: cacheSize
            })
        }
        const messages = await message.channel.messages.fetch({ limit: Math.min(cacheSize, 100) })
        const target = message.content.split(" ")[2] || bot.user.id
        console.log("target: " + target)
        let request: Message[] = []
        for (let entry of messages.entries()) {
            request.push(entry[1])
            // guildCache[message.channelId].set()
        }
        for (let entry of request) {
            guildCache[message.channelId].set(entry.id, {
                role: target == entry.author.id ? "assistant" : "user",
                content: entry.cleanContent + "\nauthor: " + entry.author.globalName
            })
        }
        message.reply("fetched messages")
    } else {
        console.log(userData.get(message.author.id))
        console.log(message.content)
        return false
    }
}