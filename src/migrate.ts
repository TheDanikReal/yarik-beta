import type { UserData } from "./index.ts"
import console from "node:console"
import { promises as fs } from "node:fs"
import { deserialize } from "node:v8"
import { database } from "./base.ts"

const servers: Map<string, boolean> = deserialize(await fs.readFile("servers.db"))
const users: Map<string, UserData> = deserialize(await fs.readFile("users.db"))

const alreadyExists = "{type} {id} already exists in database"

for (const server of servers.entries()) {
    if (!database.findChannel(server[0])) {
        database.addChannel(server[0], server[1])
    } else {
        console.log(alreadyExists.replace("{type}", "server").replace("{id}", server[0]))
    }
}

for (const user of users.entries()) {
    if (!database.findUser(user[0])) {
        database.addUser(user[0], user[1].model)
    } else {
        console.log(alreadyExists.replace("{type}", "user").replace("{id}", user[0]))
    }
}

console.log(servers)
console.log(users)
