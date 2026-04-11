import {
  AVAILABLE_MODELS,
  ModelDefinition,
  generateAIResponse,
  GenerationResult,
  getModelById,
  getCheapestModel,
} from "../aiProviders";
import { logger } from "../utils/logger";
import { ServiceUnavailableError } from "../utils/errorHandler";

export interface AiRequestOptions {
  prompt: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Routes the prompt to the best available AI provider.
 *
 * Strategy (controlled by LOAD_BALANCING_STRATEGY env var):
 *  - "cheapest" (default): lowest cost per token
 *  - "round-robin": cycle through providers
 *  - "fastest": pick based on measured latency (stub — same as cheapest for now)
 */
export async function routeAiRequest(options: AiRequestOptions): Promise<GenerationResult> {
  const strategy = process.env.LOAD_BALANCING_STRATEGY ?? "cheapest";

  let preferred: ModelDefinition | undefined;

  if (options.modelId) {
    preferred = getModelById(options.modelId);
    if (!preferred) {
      logger.warn("Requested model not found, falling back to cheapest", { modelId: options.modelId });
    }
  }

  const orderedModels = preferred
    ? [preferred, ...AVAILABLE_MODELS.filter((m) => m.id !== preferred!.id)]
    : getOrderedModels(strategy);

  let lastError: Error | null = null;

  for (const modelDef of orderedModels) {
    try {
      return await generateAIResponse(
        modelDef,
        options.prompt,
        options.maxTokens ?? 2048,
        options.temperature ?? 0.7
      );
    } catch (err) {
      lastError = err as Error;
      logger.warn(`Provider ${modelDef.provider} (${modelDef.id}) failed, trying next`, {
        error: (err as Error).message,
      });
    }
  }

  throw new ServiceUnavailableError("All AI providers are currently unavailable", {
    lastError: lastError?.message,
  });
}

function getOrderedModels(strategy: string): ModelDefinition[] {
  switch (strategy) {
    case "round-robin":
      return rotateModels(AVAILABLE_MODELS);
    case "cheapest":
    default:
      return [...AVAILABLE_MODELS].sort(
        (a, b) =>
          a.costPerKInput + a.costPerKOutput - (b.costPerKInput + b.costPerKOutput)
      );
  }
}

let roundRobinIndex = 0;
function rotateModels(models: ModelDefinition[]): ModelDefinition[] {
  const start = roundRobinIndex % models.length;
  roundRobinIndex = (roundRobinIndex + 1) % models.length;
  return [...models.slice(start), ...models.slice(0, start)];
}
