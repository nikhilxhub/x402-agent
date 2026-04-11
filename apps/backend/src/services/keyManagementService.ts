import { createHash } from "crypto";
import { logger } from "../utils/logger";
import { ValidationError } from "../utils/errorHandler";

export interface ApiKeyRecord {
  keyHash: string;
  ownerWallet: string;
  model: string;
  dailyRequestLimit: number;
  dailyRequestCount: number;
  dailyResetAt: number; // Unix ms timestamp for next reset
  totalEarnings: bigint; // lamports
  requestCount: number;
  isActive: boolean;
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
    ownerWallet: input.ownerWallet,
    model: input.model ?? "any",
    dailyRequestLimit: input.dailyRequestLimit ?? 1000,
    dailyRequestCount: 0,
    dailyResetAt: nextMidnightUtc(),
    totalEarnings: 0n,
    requestCount: 0,
    isActive: true,
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

/** Pick an available (active, under daily limit) API key for a given provider/model. */
export function selectApiKey(model?: string): ApiKeyRecord | null {
  for (const record of apiKeyPool.values()) {
    if (!record.isActive) continue;
    if (model && record.model !== "any" && record.model !== model) continue;

    // Reset daily counter if needed
    if (Date.now() > record.dailyResetAt) {
      record.dailyRequestCount = 0;
      record.dailyResetAt = nextMidnightUtc();
    }

    if (record.dailyRequestCount < record.dailyRequestLimit) {
      return record;
    }
  }
  return null;
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

function nextMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime();
}
