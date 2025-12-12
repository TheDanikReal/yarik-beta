import { defineConfig } from "rolldown"
import process from "node:process"

export default defineConfig({
    input: "src/api.ts",
    output: {
        format: "cjs",
        minify: process.argv.includes("--no-minify") ? false : true,
        file: "bundle.cjs"
    }
    //external: ["bufferutil"]
})
