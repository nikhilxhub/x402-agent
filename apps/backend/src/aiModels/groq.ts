import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';



export async function callGROQ(prompt:string, api_key: string) {
    
    const groq_client = createGroq({
        apiKey: api_key,
    });

    const { text } = await generateText({

        model: groq_client("llama-3.3-70b-versatile"),
        prompt,
    })

    return text;
}