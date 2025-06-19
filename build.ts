import { build } from "esbuild"
import { readFile, writeFile } from "node:fs/promises"

const fileName = "bundle.cjs"

/*const urlPlugin: Plugin = {
    name: "urlPlugin",
    setup(build) {
        
    },
}*/

await build({
    entryPoints: ["index.ts"],
    bundle: true,
    outfile: fileName,
    platform: "node"
    //plugins: [urlPlugin]
})

const regex = /import_meta[1-9]*\.url/g

let file = await readFile(fileName, "utf-8")
file = file.replaceAll(regex, "\"file:///\"")
writeFile(fileName, file, "utf-8")