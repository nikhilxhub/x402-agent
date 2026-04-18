// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// export default prisma;

// export const findApiKeyToModel = async (modelKey: string) => {
//   if (!modelKey) return null;

//   const record = await prisma.apiKey.findFirst({
//     where: { ai_model: modelKey },
//   });

//   return record ?? null;
// };
import dotenv from "dotenv";
dotenv.config();

type ApiKeyRecord = {
  ai_model: string;
  api_key: string;
  owner_sol: string;
  rate_per_request: number;
};

// Local in-memory key store
const apiKeyMap: Record<string, ApiKeyRecord> = {
  "gpt-3.5-turbo": {
    ai_model: "gpt-3.5-turbo",
    api_key: process.env.OPENAI_API_KEY!,
    owner_sol: process.env.DEFAULT_OWNER ?? "9M3y3UhZb29mqVu9zW7LRSESdAuoYBXCabgozqDR5JML",
    rate_per_request: 1000000,
  },
  "groq": {
    ai_model: "groq",
    api_key: process.env.groq_API_KEY!,
    owner_sol: process.env.DEFAULT_OWNER ?? "9M3y3UhZb29mqVu9zW7LRSESdAuoYBXCabgozqDR5JML",
    rate_per_request: 1000000,
  },
  "gemini-2": {
    ai_model: "gemini-2",
    api_key: process.env.GOOGLE_API_KEY2!,
    owner_sol: process.env.DEFAULT_OWNER ?? "9M3y3UhZb29mqVu9zW7LRSESdAuoYBXCabgozqDR5JML",
    rate_per_request: 1000000,
  },
  "gemini-2.5-pro": {
    ai_model: "gemini-2.5-pro",
    api_key: process.env.GOOGLE_API_KEY!,
    owner_sol: process.env.DEFAULT_OWNER ?? "9M3y3UhZb29mqVu9zW7LRSESdAuoYBXCabgozqDR5JML",
    rate_per_request: 1000000,
  },
};


export function findApiKeyToModel2(modelKey: string): ApiKeyRecord | null {
  if (!modelKey) return null;
  const record = apiKeyMap[modelKey];
  return record ?? null;
}
