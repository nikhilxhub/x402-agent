import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";


export async function callGEMINI(prompt:string, api_key:string) {
    const gemini_client = createGoogleGenerativeAI({
        apiKey: api_key,
    });

    const { text } = await generateText({
        model: gemini_client("gemini-2.5-pro"),
        prompt,
    });

    return text;
    
}
