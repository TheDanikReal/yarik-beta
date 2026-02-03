import type { Prisma } from "../generated/prisma/client.ts"
import process from "node:process"
import { PrismaPg } from "@prisma/adapter-pg"
import { LRUCache } from "lru-cache"
import { PrismaClient } from "../generated/prisma/client.ts"
import "dotenv/config"

class PrismaDatabase {
    prisma: PrismaClient
    cacheUsers: LRUCache<string, Partial<Prisma.UserCreateInput>>
    cacheChannels: LRUCache<string, Partial<Prisma.ChannelCreateInput>>
    constructor() {
        this.cacheUsers = new LRUCache<string, Partial<Prisma.UserCreateInput>>({
            ttl: 1000 * 60 * 30,
            max: 100
        })
        this.cacheChannels = new LRUCache<string, Partial<Prisma.ChannelCreateInput>>({
            ttl: 1000 * 60 * 30,
            max: 100
        })
        const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL})
        this.prisma = new PrismaClient({ adapter })
    }
    async connect() {
        await this.prisma.$connect()
    }
    async disconnect() {
        await this.prisma.$disconnect()
    }
    async users() {
        return await this.prisma.user.findMany()
    }
    async findChannel(channelId: string) {
        const cachedChannel = this.cacheChannels.get(channelId)
        if (cachedChannel) {
            return cachedChannel
        } else {
            const channel = await this.prisma.channel.findFirst({
                where: {
                    id: channelId
                }
            })
            this.cacheChannels.set(channelId, { ...channel })
            return channel
        }
    }
    async addChannel(channelId: string, enabled: boolean) {
        this.cacheChannels.set(channelId, { id: channelId, enabled })
        return await this.prisma.channel.create({
            data: {
                id: channelId,
                enabled
            }
        })
    }
    async editChannelIfExists(channelId: string, enabled: boolean) {
        this.cacheChannels.set(channelId, { id: channelId, enabled })
        if (
            await this.prisma.channel.findFirst({
                where: {
                    id: channelId
                }
            })
        ) {
            return await this.prisma.channel.update({
                where: {
                    id: channelId
                },
                data: {
                    enabled
                }
            })
        } else {
            return await this.prisma.channel.create({
                data: {
                    id: channelId,
                    enabled
                }
            })
        }
    }
    async findUser(userId: string) {
        const cachedUser = this.cacheUsers.get(userId)
        if (cachedUser) {
            return cachedUser
        } else {
            const user = await this.prisma.user.findFirst({
                where: {
                    id: userId
                }
            })
            this.cacheUsers.set(userId, { ...user })
            return user
        }
    }
    // deno-lint-ignore require-await
    async addUser(userId: string, model: string) {
        this.cacheUsers.set(userId, { id: userId, model })
        return this.prisma.user.create({
            data: {
                id: userId,
                model
            }
        })
    }
    async editUser(userId: string, newData: Partial<Prisma.UserCreateInput>) {
        this.cacheUsers.set(userId, { id: userId, ...newData })
        return await this.prisma.user.update({
            where: {
                id: userId
            },
            data: {
                ...newData
            }
        })
    }
    async editUserIfExists(userId: string, model: string) {
        this.cacheUsers.set(userId, { id: userId, model })
        if (
            await this.prisma.user.findFirst({
                where: {
                    id: userId
                }
            })
        ) {
            return this.prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    model
                }
            })
        } else {
            return this.prisma.user.create({
                data: {
                    id: userId,
                    model
                }
            })
        }
    }
}

export const database = new PrismaDatabase()

// const users = await database.users()
// await database.connect()
