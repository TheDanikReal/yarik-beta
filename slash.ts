import { Application, ApplicationCommandType, ChatInputCommandInteraction, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, SlashCommandBuilder, type APIApplicationCommandOptionChoice, type CacheType } from "discord.js"
import { type UserData, type SlashCommand, userData, type Interaction, type ContextMenu, generateAnswer, generateCache, cacheSize, type OpenAICompatibleMessage, bot, system, generateResponse, getClient, errorMessage, linePage, simplePage, modalFetchSize, clearChannelCache } from "./index.ts"
import { database } from "./base.ts"

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
        await database.editUserIfExists(interaction.user.id, model)
        userData.set(interaction.user.id, {
            model: model
        })
        console.log(model)
        const reply = await interaction.reply("changed model to " + model)
        console.log(reply.id)
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
            content: system.replace("{author}", interaction.user.globalName)
        })
        request.reverse()
        const client = await getClient(interaction.user.id)
        const response = await generateResponse(request, client[0], client[1])
        if (!response) {
            interaction.reply(errorMessage)
            return
        }
        let answer = await linePage(response.choices[0].message.content)
        if (!answer) {
            answer = await simplePage(response.choices[0].message.content)
        }
        interaction.editReply(answer[0] + "\n-# " + 
            response.usage.total_tokens + " tokens used")
        console.log(response.choices[0].message.content)
        if (answer.length > 1) {
            for (let message of answer) {
                interaction.channel.send(message)
            }
        }
    }
}

const commands: Interaction[] = [ setModel, generateAnswerAround ] //: SlashCommand[] = [ setModel ]

export { commands, setModel, generateAnswerAround }