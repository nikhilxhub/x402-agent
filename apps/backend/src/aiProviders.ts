/**
 * AI provider configuration via Vercel AI SDK.
 *
 * Supported:
 *  - Anthropic (Claude)    — @ai-sdk/anthropic
 *  - OpenAI (GPT-4)        — @ai-sdk/openai
 *  - Google (Gemini)       — @ai-sdk/google
 *  - Together.ai (Llama)   — @ai-sdk/openai with custom base URL
 */
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, LanguageModel } from "ai";
import { logger } from "./utils/logger";

const googleClient = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
});

// Together.ai exposes an OpenAI-compatible endpoint
const togetherClient = createOpenAI({
  baseURL: "https://api.together.xyz/v1",
  apiKey: process.env.TOGETHER_API_KEY ?? "",
});

export interface ModelDefinition {
  id: string;
  name: string;
  provider: "claude" | "openai" | "google" | "together";
  costPerKInput: number;  // USD per 1K prompt tokens
  costPerKOutput: number; // USD per 1K completion tokens
  model: LanguageModel;
}

export const AVAILABLE_MODELS: ModelDefinition[] = [
  {
    id: "claude-opus-4-20250514",
    name: "Claude Opus 4",
    provider: "claude",
    costPerKInput: 0.015,
    costPerKOutput: 0.075,
    model: anthropic("claude-opus-4-20250514"),
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "claude",
    costPerKInput: 0.003,
    costPerKOutput: 0.015,
    model: anthropic("claude-sonnet-4-6"),
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    costPerKInput: 0.005,
    costPerKOutput: 0.015,
    model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" })("gpt-4o"),
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    costPerKInput: 0.00015,
    costPerKOutput: 0.0006,
    model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" })("gpt-4o-mini"),
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    costPerKInput: 0.00125,
    costPerKOutput: 0.01,
    model: googleClient("gemini-2.5-pro"),
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    costPerKInput: 0.0003125,
    costPerKOutput: 0.0025,
    model: googleClient("gemini-2.5-flash"),
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    costPerKInput: 0.0001,
    costPerKOutput: 0.0004,
    model: googleClient("gemini-2.0-flash"),
  },
  {
    id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    name: "Llama 3.3 70B (Together)",
    provider: "together",
    costPerKInput: 0.00088,
    costPerKOutput: 0.00088,
    model: togetherClient("meta-llama/Llama-3.3-70B-Instruct-Turbo"),
  },
];

export interface GenerationResult {
  text: string;
  model: string;
  provider: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd: number;
}

/**
 * Generate text using the specified model definition.
 * Throws if the provider call fails.
 */
export async function generateAIResponse(
  modelDef: ModelDefinition,
  prompt: string,
  maxTokens = 2048,
  temperature = 0.7
): Promise<GenerationResult> {
  logger.info("Calling AI provider", { provider: modelDef.provider, model: modelDef.id });

  const { text, usage } = await generateText({
    model: modelDef.model,
    prompt,
    maxTokens,
    temperature,
  });

  const promptTokens = usage.promptTokens;
  const completionTokens = usage.completionTokens;
  const costUsd =
    (promptTokens / 1000) * modelDef.costPerKInput +
    (completionTokens / 1000) * modelDef.costPerKOutput;

  logger.info("AI response received", {
    model: modelDef.id,
    promptTokens,
    completionTokens,
    costUsd: costUsd.toFixed(6),
  });

  return {
    text,
    model: modelDef.id,
    provider: modelDef.provider,
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    costUsd,
  };
}

export function getModelById(modelId: string): ModelDefinition | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
}

/** Returns the cheapest available model (lowest combined cost per 1K tokens). */
export function getCheapestModel(): ModelDefinition {
  return AVAILABLE_MODELS.reduce((cheapest, m) => {
    const combined = m.costPerKInput + m.costPerKOutput;
    const cheapestCombined = cheapest.costPerKInput + cheapest.costPerKOutput;
    return combined < cheapestCombined ? m : cheapest;
  });
}
