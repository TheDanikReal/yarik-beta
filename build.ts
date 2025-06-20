import { build } from "esbuild"
import { readFile, writeFile } from "node:fs/promises"

const fileName = "bundle.cjs"

await build({
    entryPoints: ["api.ts"],
    bundle: true,
    outfile: fileName,
    platform: "node"
    //plugins: [urlPlugin]
})

const regex = /import_meta[1-9]*\.url/g

// new version of prisma client uses import.meta.url for finding query engine, which is
// not supported on cjs, so we are replacing it with file:///
let file = await readFile(fileName, "utf-8")
file = file.replaceAll(regex, "\"file:///\"")
writeFile(fileName, file, "utf-8")