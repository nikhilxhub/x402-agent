import "dotenv/config";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import { globalErrorHandler, ValidationError } from "./utils/errorHandler";
import { logger } from "./utils/logger";
import { processChatRequest } from "./services/paymentService";
import { analytics, requestHistory } from "./services/paymentService";
import { registerApiKey, getKeyEarnings } from "./services/keyManagementService";
import { AVAILABLE_MODELS, getActiveModels, getModelById, isProviderKeySet } from "./aiProviders";
import { getModelsWithUserKeys } from "./services/keyManagementService";

const app: Application = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "*",
}));
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Service health check.
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    x402Enabled: true,
    paymentToken: "SOL",
    requiredAmount: parseInt(process.env.X402_PAYMENT_AMOUNT_LAMPORTS ?? "10000000", 10),
    recipientWallet: process.env.PLATFORM_WALLET ?? null,
    magicblockEnabled: Boolean(process.env.PLATFORM_WALLET_PRIVATE_KEY),
    network: process.env.SOLANA_NETWORK ?? "devnet",
    uptime: process.uptime(),
  });
});

/**
 * POST /api/chat
 * Main pay-per-prompt endpoint.
 *
 * Headers:
 *   x-payment: base64-encoded Solana transaction signature
 *
 * Body:
 *   { prompt: string, model?: string, consumer_wallet?: string }
 */
app.post("/api/chat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const xPayment = req.headers["x-payment"] as string | undefined;

    if (!xPayment) {
      res.status(402).json({
        error: "Payment required",
        details: "Include a valid Solana transaction signature in the x-payment header (base64 encoded).",
        requiredAmount: parseInt(process.env.X402_PAYMENT_AMOUNT_LAMPORTS ?? "10000000", 10),
        paymentToken: "SOL",
        recipientWallet: process.env.PLATFORM_WALLET,
      });
      return;
    }

    const { prompt, model, consumer_wallet } = req.body as {
      prompt?: string;
      model?: string;
      consumer_wallet?: string;
    };

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      throw new ValidationError("prompt is required and must be a non-empty string");
    }

    const result = await processChatRequest(
      xPayment,
      { prompt: prompt.trim(), modelId: model },
      consumer_wallet
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/keys/register
 * Register an API key for staking and earning.
 *
 * Body: { apiKey, ownerWallet, model?, dailyRequestLimit? }
 */
app.post("/api/keys/register", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey, ownerWallet, model, dailyRequestLimit } = req.body as {
      apiKey?: string;
      ownerWallet?: string;
      model?: string;
      dailyRequestLimit?: number;
    };

    if (!apiKey || !ownerWallet) {
      throw new ValidationError("apiKey and ownerWallet are required");
    }

    const result = registerApiKey({ apiKey, ownerWallet, model, dailyRequestLimit });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/keys/:keyHash/earnings
 * Check total earnings for an API key by its hash.
 */
app.get("/api/keys/:keyHash/earnings", (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyHash = String(req.params["keyHash"] ?? "");
    const record = getKeyEarnings(keyHash);
    res.json({
      keyHash: record.keyHash,
      ownerWallet: record.ownerWallet,
      totalEarnings: record.totalEarnings.toString(), // lamports as string (BigInt safe)
      requestCount: record.requestCount,
      dailyRequestCount: record.dailyRequestCount,
      dailyRequestLimit: record.dailyRequestLimit,
      isActive: record.isActive,
      consecutiveFailures: record.consecutiveFailures,
      blacklisted: record.blacklistedAt !== null,
      blacklistedAt: record.blacklistedAt,
      createdAt: record.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/providers
 * List providers that are actually usable right now:
 *  - platform providers where the .env key is set
 *  - providers unlocked by a user-registered key
 */
app.get("/api/providers", (_req: Request, res: Response) => {
  const visibleModels = resolveVisibleModels();
  const providerMap: Record<
    string,
    { id: string; enabled: boolean; source: string; models: string[]; pricing: { input: number; output: number }; tags: string[] }
  > = {};

  for (const { model: m, source } of visibleModels) {
    if (!providerMap[m.provider]) {
      providerMap[m.provider] = {
        id: m.provider,
        enabled: true,
        source,
        models: [],
        pricing: { input: m.costPerKInput, output: m.costPerKOutput },
        tags: getProviderTags(m.provider),
      };
    }
    providerMap[m.provider]!.models.push(m.id);
  }

  res.json(Object.values(providerMap));
});

/**
 * GET /api/models
 * Returns only models that can actually be called right now:
 *  - platform models where the .env key is set  (source: "platform")
 *  - models unlocked by a user-registered key   (source: "user-provided")
 */
app.get("/api/models", (_req: Request, res: Response) => {
  res.json(
    resolveVisibleModels().map(({ model: m, source }) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      source,
      costPerK: { input: m.costPerKInput, output: m.costPerKOutput },
    }))
  );
});

/**
 * GET /api/analytics
 * Platform-level request and cost analytics.
 */
app.get("/api/analytics", (_req: Request, res: Response) => {
  const avgCost =
    analytics.totalRequests > 0
      ? analytics.totalCostUsd / analytics.totalRequests
      : 0;

  res.json({
    totalRequests: analytics.totalRequests,
    totalCostUsd: parseFloat(analytics.totalCostUsd.toFixed(6)),
    averageCostPerRequest: parseFloat(avgCost.toFixed(6)),
    byProvider: analytics.byProvider,
    x402Stats: {
      processedPayments: analytics.x402ProcessedPayments,
    },
    recentRequests: requestHistory.slice(-10).map((r) => ({
      requestId: r.requestId,
      model: r.modelId,
      provider: r.providerId,
      tokens: r.promptTokens + r.completionTokens,
      timestamp: r.timestamp,
    })),
  });
});

// ── Error handler (must be last) ─────────────────────────────────────────────

app.use(globalErrorHandler);

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`Backend API listening on port ${PORT}`, {
    network: process.env.SOLANA_NETWORK ?? "devnet",
    magicblock: Boolean(process.env.PLATFORM_WALLET_PRIVATE_KEY),
  });
});

export default app;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getProviderTags(provider: string): string[] {
  switch (provider) {
    case "claude":
      return ["premium", "accurate", "long-context"];
    case "openai":
      return ["fast", "reliable"];
    case "together":
      return ["open-source", "cheap"];
    default:
      return [];
  }
}

/**
 * Builds the unified list of models visible to callers:
 *  - platform models where the .env key is present
 *  - models in AVAILABLE_MODELS that have at least one active user-registered key
 *    (de-duplicated; platform takes precedence on source label)
 */
function resolveVisibleModels(): Array<{ model: ReturnType<typeof getModelById> extends undefined ? never : NonNullable<ReturnType<typeof getModelById>>; source: "platform" | "user-provided" }> {
  const result: Array<{ model: NonNullable<ReturnType<typeof getModelById>>; source: "platform" | "user-provided" }> = [];
  const seen = new Set<string>();

  for (const m of getActiveModels()) {
    result.push({ model: m, source: "platform" });
    seen.add(m.id);
  }

  for (const modelId of getModelsWithUserKeys()) {
    if (seen.has(modelId)) continue; // already listed as platform model
    const def = getModelById(modelId);
    if (def) {
      result.push({ model: def, source: "user-provided" });
      seen.add(modelId);
    }
  }

  return result;
}
