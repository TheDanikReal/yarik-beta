import console from "node:console"
import type { ChatCompletionTool } from "openai/resources/index.mjs"

export interface Tools {
    [tool: string]: (args: { description: string }) => string
}

export const tools: Tools = {
    // deno-lint-ignore camelcase
    generate_image: (test: { description: string }) => {
        console.log(test)
        return "generated image"
    }
}

export const toolDescriptions: ChatCompletionTool[] = [
    {
        "type": "function",
        "function": {
            "name": "generate_image",
            "description": "generates image from description",
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "description for image to generate"
                    }
                },
                "required": ["description"]
            }
        }
    }
    /*
    {
        type: "function",
        function: {
            name: "generate_image",
            description: "generates image from description",
            parameters: {
                type: "object",
                description: {
                    type: "string",
                    description: "description for image to generate"
                },
                required: ["description"]
            }
        }
    }*/
]
