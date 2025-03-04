import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import { type UserData, type SlashCommand, userData } from "./index.ts"

const setModel: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("setmodel")
        .setDescription("Sets model of bot")
        .addStringOption(option => option.setName("model").addChoices(
            { name: "gpt", value: "gpt-4o" },
            { name: "gemini 2.0 pro", value: "gemini-2.0-pro-exp-02-05" }
        ).setDescription("changes used model user side")
        .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) { 
        const model = interaction.options.getString("model") as UserData["model"]
        userData.set(interaction.user.id, {
            model: model
        })
        console.log(model)
        const reply = await interaction.reply("changed model to " + model)
        console.log(reply.id)
    }
}

const commands = [ setModel ] //: SlashCommand[] = [ setModel ]

export { commands, setModel }