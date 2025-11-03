import { defineConfig } from "rolldown"

export default defineConfig({
    input: "src/api.ts",
    output: {
        format: "cjs",
        minify: true,
        file: "bundle.cjs"
    }
})
