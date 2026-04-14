import {
  ModelDefinition,
  generateAIResponse,
  GenerationResult,
  getModelById,
  getActiveModels,
  buildModelWithKey,
} from "../aiProviders";
import {
  selectApiKeys,
  recordKeyFailure,
  recordKeySuccess,
} from "./keyManagementService";
import { logger } from "../utils/logger";
import { ServiceUnavailableError } from "../utils/errorHandler";

export interface AiRequestOptions {
  prompt: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

// ── Platform model failure tracking ──────────────────────────────────────────
// Tracks consecutive failures per platform model ID.
// A model in cooldown is skipped during routing and retried after the window expires.

const PLATFORM_FAILURE_THRESHOLD = 3;
const PLATFORM_COOLDOWN_MS       = 5 * 60 * 1000; // 5 minutes

interface PlatformModelHealth {
  consecutiveFailures: number;
  cooldownUntil: number; // Unix ms; 0 = no cooldown
}

const platformHealth = new Map<string, PlatformModelHealth>();

function getPlatformHealth(modelId: string): PlatformModelHealth {
  if (!platformHealth.has(modelId)) {
    platformHealth.set(modelId, { consecutiveFailures: 0, cooldownUntil: 0 });
  }
  return platformHealth.get(modelId)!;
}

function recordPlatformFailure(modelId: string): void {
  const h = getPlatformHealth(modelId);
  h.consecutiveFailures += 1;

  if (h.consecutiveFailures >= PLATFORM_FAILURE_THRESHOLD) {
    h.cooldownUntil = Date.now() + PLATFORM_COOLDOWN_MS;
    logger.warn("Platform model entering cooldown after repeated failures", {
      model: modelId,
      consecutiveFailures: h.consecutiveFailures,
      cooldownUntilIso: new Date(h.cooldownUntil).toISOString(),
    });
  } else {
    logger.warn("Platform model failure recorded", {
      model: modelId,
      consecutiveFailures: h.consecutiveFailures,
      threshold: PLATFORM_FAILURE_THRESHOLD,
    });
  }
}

function recordPlatformSuccess(modelId: string): void {
  const h = getPlatformHealth(modelId);
  if (h.consecutiveFailures > 0) {
    logger.info("Platform model recovered", { model: modelId, previousFailures: h.consecutiveFailures });
    h.consecutiveFailures = 0;
    h.cooldownUntil = 0;
  }
}

function isInCooldown(modelId: string): boolean {
  const h = platformHealth.get(modelId);
  if (!h || h.cooldownUntil === 0) return false;
  if (Date.now() > h.cooldownUntil) {
    // Cooldown expired — reset so the model gets a fresh chance
    h.consecutiveFailures = 0;
    h.cooldownUntil = 0;
    logger.info("Platform model cooldown expired, re-enabling", { model: modelId });
    return false;
  }
  return true;
}

// ── Main router ───────────────────────────────────────────────────────────────

/**
 * Routes the prompt to the best available AI provider.
 *
 * Priority:
 *  1. User-registered keys for the requested model, ordered healthiest-first.
 *     Each failure calls recordKeyFailure (blacklists at 3 strikes).
 *     First success stops the loop and resets that key's failure counter.
 *  2. Platform .env models, skipping any in cooldown, ordered by LOAD_BALANCING_STRATEGY.
 *     Each failure calls recordPlatformFailure (5-min cooldown at 3 strikes).
 *
 * Returns GenerationResult with usedKeyHash set when a user key was used.
 */
export async function routeAiRequest(options: AiRequestOptions): Promise<GenerationResult> {
  const maxTokens   = options.maxTokens  ?? 2048;
  const temperature = options.temperature ?? 0.7;

  // ── 1. Try all user-registered keys for the requested model ─────────────────
  if (options.modelId) {
    const userKeys = selectApiKeys(options.modelId); // ordered: fewest failures first

    for (const keyRecord of userKeys) {
      const userLM   = buildModelWithKey(options.modelId, keyRecord.rawKey);
      const modelDef = getModelById(options.modelId);

      if (!userLM || !modelDef) continue;

      try {
        logger.info("Trying user-registered key", {
          model: options.modelId,
          keyHash: keyRecord.keyHash,
          consecutiveFailures: keyRecord.consecutiveFailures,
        });

        const result = await generateAIResponse(
          { ...modelDef, model: userLM },
          options.prompt,
          maxTokens,
          temperature,
        );

        recordKeySuccess(keyRecord.keyHash);
        return { ...result, usedKeyHash: keyRecord.keyHash };
      } catch (err) {
        recordKeyFailure(keyRecord.keyHash);
        logger.warn("User key failed, trying next user key or platform fallback", {
          model: options.modelId,
          keyHash: keyRecord.keyHash,
          error: (err as Error).message,
        });
      }
    }
  }

  // ── 2. Fall back to platform .env models ─────────────────────────────────────
  const activeModels = getActiveModels().filter(m => !isInCooldown(m.id));

  if (activeModels.length === 0) {
    throw new ServiceUnavailableError(
      "No AI providers are available right now. All platform models are in cooldown or unconfigured."
    );
  }

  const strategy = process.env.LOAD_BALANCING_STRATEGY ?? "cheapest";
  const preferred = options.modelId ? activeModels.find(m => m.id === options.modelId) : undefined;
  const ordered   = preferred
    ? [preferred, ...activeModels.filter(m => m.id !== preferred.id)]
    : getOrderedModels(strategy, activeModels);

  let lastError: Error | null = null;

  for (const modelDef of ordered) {
    if (isInCooldown(modelDef.id)) continue; // re-check in case cooldown expired mid-loop

    try {
      const result = await generateAIResponse(modelDef, options.prompt, maxTokens, temperature);
      recordPlatformSuccess(modelDef.id);
      return result; // usedKeyHash is undefined → platform key was used
    } catch (err) {
      lastError = err as Error;
      recordPlatformFailure(modelDef.id);
      logger.warn(`Platform model ${modelDef.id} failed, trying next`, {
        error: (err as Error).message,
      });
    }
  }

  throw new ServiceUnavailableError("All AI providers are currently unavailable", {
    lastError: lastError?.message,
  });
}

// ── Ordering helpers ──────────────────────────────────────────────────────────

function getOrderedModels(strategy: string, models: ModelDefinition[]): ModelDefinition[] {
  switch (strategy) {
    case "round-robin":
      return rotateModels(models);
    case "cheapest":
    default:
      return [...models].sort(
        (a, b) => (a.costPerKInput + a.costPerKOutput) - (b.costPerKInput + b.costPerKOutput)
      );
  }
}

let roundRobinIndex = 0;
function rotateModels(models: ModelDefinition[]): ModelDefinition[] {
  const start = roundRobinIndex % models.length;
  roundRobinIndex = (roundRobinIndex + 1) % models.length;
  return [...models.slice(start), ...models.slice(0, start)];
}
