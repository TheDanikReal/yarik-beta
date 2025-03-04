import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ChatInputCommandInteraction, Message, type CacheType, type OmitPartialGroupDMChannel } from "discord.js"
import { enabledChannels, userData } from "./index.ts"
import { saveData } from "./button.ts"
import { setModel } from "./slash.ts"

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
    } else {
        console.log(userData.get(message.author.id))
        console.log(message.content)
        return false
    }
}