import * as http from "node:http"
import { startBot } from "./index.ts"

startBot()

console.log("started")

const port = process.env.PORT || 3000

const server = http.createServer((req, res) => {
    if (req.url == "/") {
        res.writeHead(200, { "content-type": "text/plain" })
        res.end("OK")
    }
})

server.listen(port, () => {
    console.log("server is running on port ", port, " ")
})