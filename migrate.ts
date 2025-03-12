import { promises as fs } from "node:fs"
import { deserialize } from "node:v8"
import { database } from "./base.ts"
import type { UserData } from "./index.ts"

const servers: Map<string, boolean> = deserialize(await fs.readFile("servers.db"))
const users: Map<string, UserData> = deserialize(await fs.readFile("users.db"))

for (let server of servers.entries()) {
    if (!database.findChannel(server[0])) {
        database.addChannel(server[0], server[1])
    }
}

for (let user of users.entries()) {
    if (!database.findUser(user[0])) {
        database.addUser(user[0], user[1].model)
    }
}

console.log(servers)
console.log(users)