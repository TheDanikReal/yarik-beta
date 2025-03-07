import type { ChatCompletionTool } from "openai/resources/index.mjs";

export const tools: { [tool: string]: () => {} } = {

}

export const toolDescriptions: ChatCompletionTool[] = [{
    type: "function",
    function: {
        name: "generateImage",
        description: "generates image from description",
        parameters: {
            type: "object",
            properties: {
                type: "string",
                description: "description for image to generate"
            },
            required: ["string"]
        }
    }
}]