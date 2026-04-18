import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from 'ai';


export async function callGPT4(prompt: string, api_key:string){

    const openai_client = createOpenAI({
        apiKey:api_key,
    });

    const { text } = await generateText({
        model: openai_client("gpt-3.5-turbo"),
        prompt
    });

    return text;

}

