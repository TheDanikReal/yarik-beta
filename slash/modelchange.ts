import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import { logger, type UserData, userData } from "./../index.ts"

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setModel")
        .setDescription("Sets model of bot")
        .addStringOption((option) =>
            option.setName("model").addChoices(
                { name: "gpt", value: "gpt-4o" },
                { name: "gemini 2.0 pro", value: "gemini-2.0-pro-exp-02-05" }
            ).setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        const model = interaction.options.getString("model") as UserData["model"]
        userData.set(interaction.user.id, {
            model: model
        })
        logger.debug(`changed model for ${interaction.user.id} to ${model}`)
    }
}