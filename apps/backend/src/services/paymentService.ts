import { v4 as uuidv4 } from "uuid";
import { verifyX402Payment, PaymentVerificationResult } from "../x402PaymentVerifier";
import { settlePayment, SettlementResult } from "../magicBlockPayments";
import { routeAiRequest, AiRequestOptions } from "./aiService";
import { GenerationResult } from "../aiProviders";
import {
  getKeyEarnings,
  recordEarnings,
} from "./keyManagementService";
import { logger } from "../utils/logger";
import { ServiceUnavailableError } from "../utils/errorHandler";

const PAYMENT_AMOUNT_LAMPORTS = parseInt(
  process.env.X402_PAYMENT_AMOUNT_LAMPORTS ?? "10000000",
  10
);
const LAMPORTS_PER_SOL = 1_000_000_000;

export interface RequestRecord {
  requestId: string;
  consumerId: string;  // payer wallet
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  paymentSignature: string;
  settlementSignature: string;
  apiKeyHash: string;
  timestamp: string;
}

// In-memory request history — replace with a DB for production
export const requestHistory: RequestRecord[] = [];

// Analytics counters
export const analytics = {
  totalRequests: 0,
  totalCostUsd: 0,
  byProvider: {} as Record<string, number>,
  x402ProcessedPayments: 0,
};

export interface ChatResult {
  response: string;
  model: string;
  tokens: { prompt: number; completion: number; total: number };
  receipt: {
    requestId: string;
    paymentSignature: string;
    paymentAmount: number;
    paymentStatus: "verified";
    settlementSignature: string;
    settlementMethod: string;
    apiKeyOwner: string;
    apiKeyEarnings: number;
    platformFee: number;
    timestamp: string;
  };
}

/**
 * Orchestrates the full pay-per-prompt flow:
 *  1. Verify x402 payment
 *  2. Resolve API key holder
 *  3. Route to AI provider
 *  4. Settle via MagicBlock
 *  5. Record request and return receipt
 */
export async function processChatRequest(
  xPaymentHeader: string,
  aiOptions: AiRequestOptions,
  consumerWallet?: string
): Promise<ChatResult> {
  const requestId = uuidv4();
  const timestamp = new Date().toISOString();

  logger.info("Processing chat request", { requestId, model: aiOptions.modelId });

  // 1. Verify payment
  const payment: PaymentVerificationResult = await verifyX402Payment(xPaymentHeader);
  analytics.x402ProcessedPayments += 1;

  // 2. Call AI — aiService tries all user keys (healthiest first) then platform fallback.
  //    usedKeyHash is set when a user-registered key was actually used.
  const aiResult: GenerationResult = await routeAiRequest(aiOptions);

  // 3. Resolve the key holder for earnings attribution
  const keyRecord = aiResult.usedKeyHash ? getKeyEarnings(aiResult.usedKeyHash) : null;

  // 4. Settle payment — key holder earns 80%, platform keeps all if no user key was used
  const totalSol = PAYMENT_AMOUNT_LAMPORTS / LAMPORTS_PER_SOL;
  const recipientWallet = keyRecord?.ownerWallet ?? process.env.PLATFORM_WALLET ?? payment.payer;
  const settlement: SettlementResult = await settlePayment(
    consumerWallet ?? payment.payer,
    recipientWallet,
    totalSol
  );

  // 5. Record earnings for the key holder (80% in lamports) if a user key was used
  if (keyRecord) {
    const earningsLamports = BigInt(Math.floor(PAYMENT_AMOUNT_LAMPORTS * 0.8));
    recordEarnings(keyRecord.keyHash, earningsLamports);
  }

  // 6. Update analytics
  analytics.totalRequests += 1;
  analytics.totalCostUsd += aiResult.costUsd;
  analytics.byProvider[aiResult.provider] =
    (analytics.byProvider[aiResult.provider] ?? 0) + 1;

  // 7. Save request record
  const record: RequestRecord = {
    requestId,
    consumerId: payment.payer,
    providerId: aiResult.provider,
    modelId: aiResult.model,
    promptTokens: aiResult.tokens.prompt,
    completionTokens: aiResult.tokens.completion,
    costUsd: aiResult.costUsd,
    paymentSignature: payment.transactionSignature,
    settlementSignature: settlement.settlementSignature,
    apiKeyHash: keyRecord?.keyHash ?? "platform",
    timestamp,
  };
  requestHistory.push(record);

  logger.info("Chat request completed", {
    requestId,
    model: aiResult.model,
    costUsd: aiResult.costUsd.toFixed(6),
    settlementSignature: settlement.settlementSignature,
  });

  return {
    response: aiResult.text,
    model: aiResult.model,
    tokens: aiResult.tokens,
    receipt: {
      requestId,
      paymentSignature: payment.transactionSignature,
      paymentAmount: payment.amount,
      paymentStatus: "verified",
      settlementSignature: settlement.settlementSignature,
      settlementMethod: settlement.method,
      apiKeyOwner: settlement.apiKeyOwner,
      apiKeyEarnings: settlement.apiKeyEarnings,
      platformFee: settlement.platformFee,
      timestamp,
    },
  };
}
