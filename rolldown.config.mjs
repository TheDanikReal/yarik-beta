import process from "node:process"
// @ts-check
import { defineConfig } from "rolldown"

export default defineConfig({
    input: "src/api.ts",
    output: {
        format: "cjs",
        minify: !process.argv.includes("--no-minify"),
        file: "bundle.cjs",
        inlineDynamicImports: true
    }
    //external: ["bufferutil"]
})
