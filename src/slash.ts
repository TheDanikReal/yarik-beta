import type {
    ChatInputCommandInteraction,
    GuildTextBasedChannel,
    Message,
    TextBasedChannel
} from "discord.js"
import type {
    Interaction,
    SlashCommand,
    UserData
} from "./index.ts"
import {
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorSpacingSize,
    SlashCommandBuilder,
    TextDisplayBuilder
} from "discord.js"
import { database } from "./base.ts"
import { fetchMaxSize } from "./consts.ts"
import {
    bot,
    clearChannelCache,
    generateCache,
    logger,
    userData
} from "./index.ts"
import { settings } from "./settings.ts"

const setModel: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName("setmodel")
        .setDescription("Sets model of bot")
        .addStringOption((option) =>
            option.setName("model").addChoices(
                ...settings.models
            ).setDescription("changes used model user side")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const reply = await interaction.reply("changing model")
            const model = interaction.options.getString("model") as UserData["model"]
            await database.editUserIfExists(interaction.user.id, model)
            userData.set(interaction.user.id, {
                model
            })
            reply.edit(`changed model to ${model}`)
            logger.trace(`changed model for ${interaction.user.id} to ${model}`)
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
        } else if (fetchChannel.type !== ChannelType.GuildText) {
            interaction.reply("this command can only be used on text channels")
            return
        }
        const message = await interaction.reply("fetching messages")
        logger.trace(`generating cache for ${fetchChannel.id}`)
        const messages = await fetchChannel.messages.fetch({
            limit: Math.min(fetchMaxSize, fetchCount)
        })
        logger.trace(`target: ${fetchUser}`)
        logger.trace(`size: ${fetchCount}`)
        const request: Message[] = []
        // TODO: move to a single function to follow DRY best practices
        for (const entry of messages.entries()) {
            if (entry[1].content.startsWith(settings.ignorePrefix)) continue
            request.push(entry[1])
        }
        request.reverse()
        for (const entry of request) {
            cache.set(entry.id, {
                role: fetchUser === entry.author.id ? "assistant" : "user",
                content: `${entry.cleanContent}\nauthor: ${entry.author.globalName}`
            })
            logger.trace(entry.cleanContent)
        }
        await message.edit("fetched messages")
    }
}

const commands: Interaction[] = [
    setModel,
    clearCache,
    infoCommand,
    fetchMessages
]

export { clearCache, commands, fetchMessages, infoCommand, setModel }
