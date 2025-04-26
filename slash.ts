import { Application, ApplicationCommandType, ChatInputCommandInteraction, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, SlashCommandBuilder, type APIApplicationCommandOptionChoice, type CacheType } from "discord.js"
import { type UserData, type SlashCommand, userData, type Interaction, type ContextMenu, generateAnswer, generateCache, cacheSize, type OpenAICompatibleMessage, bot, generateResponse, getClient, linePage, simplePage, modalFetchSize, clearChannelCache, logger } from "./index.ts"
import { database } from "./base.ts"
import { settings } from "./settings.ts"

const setModel: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("setmodel")
        .setDescription("Sets model of bot")
        .addStringOption(option => option.setName("model").addChoices(
            { name: "opencoder", value: "open-r1/olympiccoder-32b:free" },
            { name: "qwen", value: "qwen/qwq-32b:free" },
            { name: "r1", value: "deepseek/deepseek-r1:free" },
            { name: "gpt", value: "gpt-4o" },
            { name: "gemini 2.0 pro", value: "gemini-2.5-pro-exp-03-25" }
        ).setDescription("changes used model user side")
        .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) { 
        const model = interaction.options.getString("model") as UserData["model"]
        await database.editUserIfExists(interaction.user.id, model)
        userData.set(interaction.user.id, {
            model: model
        })
        logger.trace("changing model for " + interaction.user.id + " to " + model)
        const reply = await interaction.reply("changed model to " + model)
    }
}

const clearCache: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("clearcache")
        .setDescription("clears cache for channel"),
    async execute(interaction) {
        switch (await clearChannelCache(interaction.channelId)) {
            case true:
                interaction.reply("removed cache")
            case false:
                interaction.reply("cache is already empty")
        }
    }
}

const generateAnswerAround: ContextMenu = {
    data: new ContextMenuCommandBuilder()
        .setName("generate response")
        .setType(ApplicationCommandType.Message),
    async execute (interaction: MessageContextMenuCommandInteraction<CacheType>) {
        let request: OpenAICompatibleMessage[] = []
        const cache = generateCache(interaction.channelId)
        const user = bot.user.id
        const target = interaction.targetId
        const sendTyping = setInterval(() => interaction.channel.sendTyping(), 5000)
        interaction.reply("generating response")
        const messages = await interaction.channel.messages.fetch({ limit: modalFetchSize,
            before: target
        })
        clearInterval(sendTyping)
        for (let message of messages) {
            request.push({
                role: message[1].author.id == user ? "assistant" : "user",
                content: message[1].cleanContent + "\nauthor: " + message[1].author.globalName
            })
        }
        request.push({
            role: "system",
            content: settings.system.replace("{author}", interaction.user.globalName)
        })
        request.reverse()
        const client = await getClient(interaction.user.id)
        const response = await generateResponse(request, client[0], client[1])
        if (!response) {
            interaction.reply(settings.error)
            return
        }
        let answer = await linePage(response.choices[0].message.content)
        if (!answer) {
            answer = await simplePage(response.choices[0].message.content)
        }
        interaction.editReply(answer[0] + "\n-# " + 
            response.usage.total_tokens + " tokens used")
        logger.trace("generated response for " + interaction.user.id + ": "
            + response.choices[0].message.content)
        if (answer.length > 1) {
            for (let message of answer) {
                interaction.channel.send(message)
            }
        }
    }
}

const commands: Interaction[] = [ setModel, clearCache, generateAnswerAround ]

export { commands, setModel, clearCache, generateAnswerAround }