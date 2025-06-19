import { ApplicationCommandType, ButtonBuilder, ButtonStyle, type CacheType, ChannelType, ChatInputCommandInteraction, ContainerBuilder, ContextMenuCommandBuilder, type GuildTextBasedChannel, Message, MessageContextMenuCommandInteraction, MessageFlags, SectionBuilder, SeparatorSpacingSize, SlashCommandBuilder, type TextBasedChannel, TextDisplayBuilder } from "discord.js"
import { bot, clearChannelCache, type ContextMenu, generateCache, generateResponse, getClient, type Interaction, linePage, logger, type OpenAICompatibleMessage, simplePage, type SlashCommand, type UserData, userData } from "./index.ts"
import { modalFetchSize } from "./consts.ts"
import { database } from "./base.ts"
import { settings } from "./settings.ts"
import { fetchMaxSize } from "./consts.ts"
import { clearInterval, setInterval } from "node:timers"
import process from "node:process"

const setModel: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("setmodel")
        .setDescription("Sets model of bot")
        .addStringOption((option) =>
            option.setName("model").addChoices(
                { name: "qwq", value: "qwen/qwq-32b:free" },
                { name: "qwen A22B", value: "qwen/qwen3-235b-a22b:free" },
                { name: "r1 (new)", value: "deepseek/deepseek-r1-0528:free" },
                { name: "r1 (old)", value: "deepseek/deepseek-r1:free" },
                { name: "gpt 4o", value: "gpt-4o" },
                { name: "gpt 4.1", value: "openai/gpt-4.1" },
                { name: "gemini 2.5 pro", value: "gemini-2.5-pro-exp-03-25" },
                { name: "gemini flash", value: "gemini-2.5-flash-preview-05-20" }
            ).setDescription("changes used model user side")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const reply = await interaction.reply("changing model")
            const model = interaction.options.getString("model") as UserData["model"]
            await database.editUserIfExists(interaction.user.id, model)
            userData.set(interaction.user.id, {
                model: model
            })
            reply.edit("changed model to " + model)
            logger.trace("changed model for " + interaction.user.id + " to " + model)
        } catch (err) {
            logger.error(err)
        }
    }
}

const clearCache: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("clearcache")
        .setDescription("clears cache for channel"),
    async execute(interaction) {
        try {
            if (!interaction.memberPermissions?.has("ManageMessages", true)) {
                interaction.reply("user must have manage messages permission")
                return
            }
            switch (await clearChannelCache(interaction.channelId)) {
                case true:
                    interaction.reply("removed cache")
                    break
                case false:
                    interaction.reply("cache is already empty")
                    break
            }
        } catch (err) {
            logger.error(err)
        }
    }
}

const generateAnswerAround: ContextMenu = {
    data: new ContextMenuCommandBuilder()
        .setName("generate response")
        .setType(ApplicationCommandType.Message),
    async execute(interaction: MessageContextMenuCommandInteraction<CacheType>) {
        const request: OpenAICompatibleMessage[] = []
        const user = bot.user?.id
        const channel = interaction.channel as GuildTextBasedChannel
        const target = interaction.targetId
        const sendTyping = setInterval(() => channel.sendTyping(), 5000)
        interaction.reply("generating response")
        await generateCache(interaction.channelId)
        const messages = await channel.messages.fetch({ limit: modalFetchSize, before: target })
        clearInterval(sendTyping)
        if (!messages) return
        for (const message of messages) {
            request.push({
                role: message[1].author.id == user ? "assistant" : "user",
                content: message[1].cleanContent + "\nauthor: " + message[1].author.globalName
            })
        }
        request.push({
            role: "system",
            content: settings.system.replace("{author}", interaction.user.globalName as string)
        })
        request.reverse()
        const client = await getClient(interaction.user.id)
        const response = await generateResponse(request, client[0], client[1])
        if (!response) {
            interaction.reply(settings.error)
            return
        }
        const content = response.choices[0].message.content as string
        let answer = await linePage(content)
        if (!answer) {
            answer = await simplePage(content)
        }
        interaction.editReply(
            answer[0] + "\n-# " +
                response.usage?.total_tokens + " tokens used"
        )
        logger.trace(
            "generated response for " + interaction.user.id + ": " +
                response.choices[0].message.content
        )
        if (answer.length > 1) {
            for (const message of answer) {
                channel.send(message)
            }
        }
    }
}

const infoCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("info")
        .setDescription("shows information about bot"),
    async execute(interaction) {
        try {
            const container = new ContainerBuilder()
            const description = new TextDisplayBuilder().setContent(
                `# welcome to Yarik
                Yarik is a discord bot for interacting with various LLMs
                `
            )
            container.addTextDisplayComponents(description)
            container.addSeparatorComponents((separator) =>
                separator.setSpacing(
                    SeparatorSpacingSize.Large
                ).setDivider(true)
            )
            const sourceDescription = new TextDisplayBuilder().setContent(
                "Yarik is open source"
            )
            const sourceButton = new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel("view source code")
                .setURL("https://github.com/TheDanikReal/yarik-beta/")
            const section = new SectionBuilder()
                .addTextDisplayComponents(sourceDescription)
                .setButtonAccessory(sourceButton)
            container.addSectionComponents(section)
            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            })
        } catch (err) {
            logger.error(err)
        }
    }
}

const fetchMessages: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("fetch")
        .setDescription("fetches messages from a channel")
        .addIntegerOption((builder) =>
            builder.setName("count")
                .setMaxValue(fetchMaxSize)
                .setMinValue(0)
                .setDescription("count of messages to fetch")
                .setRequired(true)
        )
        .addUserOption((builder) =>
            builder.setName("user")
                .setDescription("sets user as a bot to fetch messages from")
                .setRequired(false)
        )
        .addChannelOption((builder) =>
            builder.setName("channel")
                .setDescription("sets channel to fetch messages on")
                .setRequired(false)
        ),
    async execute(interaction) {
        const channel = interaction.channel as GuildTextBasedChannel
        const cache = await generateCache(channel.id)
        const fetchCount = Math.min(interaction.options.getInteger("count", true), fetchMaxSize)
        let fetchUser = interaction.options.getUser("user", false)?.id
        let fetchChannel: TextBasedChannel | null = interaction.options.getChannel(
            "channel",
            false,
            [ChannelType.GuildText]
        )
        if (!fetchUser) {
            fetchUser = bot.user?.id
        }
        if (!fetchChannel) {
            fetchChannel = channel
        } else if (fetchChannel.type != ChannelType.GuildText) {
            interaction.reply("this command can only be used on text channels")
            return
        }
        const message = await interaction.reply("fetching messages")
        logger.trace("generating cache for " + fetchChannel.id)
        const messages = await fetchChannel.messages.fetch({
            limit: Math.min(fetchMaxSize, fetchCount)
        })
        logger.trace("target: " + fetchUser)
        logger.trace("size: " + fetchCount)
        const request: Message[] = []
        for (const entry of messages.entries()) {
            request.push(entry[1])
        }
        request.reverse()
        for (const entry of request) {
            cache.set(entry.id, {
                role: fetchUser == entry.author.id ? "assistant" : "user",
                content: entry.cleanContent + "\nauthor: " + entry.author.globalName
            })
            process.stdout.write(entry.cleanContent)
        }
        await message.edit("fetched messages")
    }
}

const commands: Interaction[] = [
    setModel,
    clearCache,
    generateAnswerAround,
    infoCommand,
    fetchMessages
]

export { clearCache, commands, fetchMessages, generateAnswerAround, infoCommand, setModel }
