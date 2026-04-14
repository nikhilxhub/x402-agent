import { createHash } from "crypto";
import { logger } from "../utils/logger";
import { ValidationError } from "../utils/errorHandler";

/** After this many consecutive failures the key is blacklisted. */
const FAILURE_THRESHOLD = 3;

export interface ApiKeyRecord {
  keyHash: string;
  /** Raw key kept in-memory only — never log, serialise, or persist to disk. */
  rawKey: string;
  ownerWallet: string;
  model: string;
  dailyRequestLimit: number;
  dailyRequestCount: number;
  dailyResetAt: number;       // Unix ms timestamp for next reset
  totalEarnings: bigint;      // lamports
  requestCount: number;
  isActive: boolean;
  consecutiveFailures: number;
  blacklistedAt: string | null; // ISO timestamp, null = not blacklisted
  createdAt: string;
}

// In-memory store: keyHash → ApiKeyRecord
// Replace with PostgreSQL for persistence.
const apiKeyPool = new Map<string, ApiKeyRecord>();

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export interface RegisterKeyInput {
  apiKey: string;
  ownerWallet: string;
  model?: string;
  dailyRequestLimit?: number;
}

export function registerApiKey(input: RegisterKeyInput): { keyHash: string; status: string } {
  if (!input.apiKey || !input.ownerWallet) {
    throw new ValidationError("apiKey and ownerWallet are required");
  }

  const keyHash = hashApiKey(input.apiKey);

  if (apiKeyPool.has(keyHash)) {
    logger.warn("API key already registered", { keyHash, owner: input.ownerWallet });
    return { keyHash, status: "already_registered" };
  }

  const record: ApiKeyRecord = {
    keyHash,
    rawKey: input.apiKey,
    ownerWallet: input.ownerWallet,
    model: input.model ?? "any",
    dailyRequestLimit: input.dailyRequestLimit ?? 1000,
    dailyRequestCount: 0,
    dailyResetAt: nextMidnightUtc(),
    totalEarnings: 0n,
    requestCount: 0,
    isActive: true,
    consecutiveFailures: 0,
    blacklistedAt: null,
    createdAt: new Date().toISOString(),
  };

  apiKeyPool.set(keyHash, record);
  logger.info("API key registered", { keyHash, owner: input.ownerWallet });

  return { keyHash, status: "active" };
}

export function getKeyEarnings(keyHash: string): ApiKeyRecord {
  const record = apiKeyPool.get(keyHash);
  if (!record) {
    throw new ValidationError(`API key not found: ${keyHash}`);
  }
  return record;
}

/**
 * Returns all active, non-blacklisted keys for a model, ordered by:
 *   1. consecutiveFailures ascending (healthiest keys first)
 *   2. registration order as tiebreaker
 *
 * Handles daily counter reset inline.
 * Returns an empty array if no eligible keys exist.
 */
export function selectApiKeys(model?: string): ApiKeyRecord[] {
  const eligible: ApiKeyRecord[] = [];

  for (const record of apiKeyPool.values()) {
    if (!record.isActive || record.blacklistedAt !== null) continue;
    if (model && record.model !== "any" && record.model !== model) continue;

    // Reset daily counter if window has rolled over
    if (Date.now() > record.dailyResetAt) {
      record.dailyRequestCount = 0;
      record.dailyResetAt = nextMidnightUtc();
    }

    if (record.dailyRequestCount < record.dailyRequestLimit) {
      eligible.push(record);
    }
  }

  // Healthiest (fewest consecutive failures) first
  return eligible.sort((a, b) => a.consecutiveFailures - b.consecutiveFailures);
}

/**
 * Called when a key produces an AI error.
 * Increments consecutiveFailures and blacklists the key at FAILURE_THRESHOLD.
 */
export function recordKeyFailure(keyHash: string): void {
  const record = apiKeyPool.get(keyHash);
  if (!record) return;

  record.consecutiveFailures += 1;

  if (record.consecutiveFailures >= FAILURE_THRESHOLD) {
    record.blacklistedAt = new Date().toISOString();
    logger.warn("API key blacklisted after repeated failures", {
      keyHash,
      owner: record.ownerWallet,
      model: record.model,
      consecutiveFailures: record.consecutiveFailures,
    });
  } else {
    logger.warn("API key failure recorded", {
      keyHash,
      consecutiveFailures: record.consecutiveFailures,
      threshold: FAILURE_THRESHOLD,
    });
  }
}

/**
 * Called when a key produces a successful AI response.
 * Resets the consecutive failure counter so a flaky key isn't permanently penalised.
 */
export function recordKeySuccess(keyHash: string): void {
  const record = apiKeyPool.get(keyHash);
  if (!record) return;

  if (record.consecutiveFailures > 0) {
    logger.info("API key recovered — resetting failure counter", { keyHash, previousFailures: record.consecutiveFailures });
    record.consecutiveFailures = 0;
  }
}

/** Record a successful request and update earnings. */
export function recordEarnings(keyHash: string, lamports: bigint): void {
  const record = apiKeyPool.get(keyHash);
  if (!record) return;

  record.totalEarnings += lamports;
  record.requestCount += 1;
  record.dailyRequestCount += 1;
}

export function getAllKeys(): ApiKeyRecord[] {
  return Array.from(apiKeyPool.values());
}

/**
 * Returns distinct model IDs for which at least one active, non-blacklisted user key is registered.
 * "any" model keys are excluded — they don't unlock a specific model.
 */
export function getModelsWithUserKeys(): string[] {
  const seen = new Set<string>();
  for (const record of apiKeyPool.values()) {
    if (record.isActive && record.blacklistedAt === null && record.model !== "any") {
      seen.add(record.model);
    }
  }
  return Array.from(seen);
}

function nextMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime();
}
