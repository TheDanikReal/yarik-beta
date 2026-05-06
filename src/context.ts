import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, type CacheType, type GuildTextBasedChannel } from "discord.js"
import { modalFetchSize } from "./consts.ts"
import { type ContextMenu, type OpenAICompatibleMessage, bot, generateCache, getClient, generateResponse, linePage, simplePage, logger, type Interaction } from "./index.ts"
import { settings } from "./settings.ts"

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
                role: message[1].author.id === user ? "assistant" : "user",
                content: `${message[1].cleanContent}\nauthor: ${message[1].author.globalName}`
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
            `${answer[0]}\n-# ${response.usage?.total_tokens} tokens used`
        )
        logger.trace(
            `generated response for ${interaction.user.id}: ${response.choices[0].message.content}`
        )
        if (answer.length > 1) {
            for (const message of answer) {
                channel.send(message)
            }
        }
    }
}

export const commands: Interaction[] = [
    generateAnswerAround
]

export { generateAnswerAround }