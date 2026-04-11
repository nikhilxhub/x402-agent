/**
 * MagicBlock Private Payments integration.
 *
 * MagicBlock's TEE-based settlement layer allows private SOL transfers with
 * no on-chain link between payer and recipient.
 *
 * API docs: https://docs.magicblock.gg/payments (replace with actual endpoint)
 * Settlement is auto-cranked to Solana after TEE confirmation.
 */
import { logger } from "./utils/logger";

const MAGICBLOCK_API_BASE =
  process.env.MAGICBLOCK_API_BASE ?? "https://api.magicblock.gg/v1";
const MAGICBLOCK_API_KEY = process.env.MAGICBLOCK_API_KEY ?? "";
const PLATFORM_WALLET = process.env.PLATFORM_WALLET ?? "";
const PLATFORM_FEE_RATIO = 0.2; // 20% platform fee
const KEY_HOLDER_RATIO = 0.8;   // 80% to API key holder

export interface SettlementResult {
  settlementSignature: string;
  apiKeyOwner: string;
  apiKeyEarnings: number; // in SOL
  platformFee: number;    // in SOL
  method: "magicblock-tee" | "simulated";
}

/**
 * Settles a request payment via MagicBlock private transfers.
 *
 * @param consumerWallet - wallet that paid (payer)
 * @param apiKeyOwnerWallet - wallet of the API key holder (gets 80%)
 * @param totalSol - total SOL to settle (e.g. 0.001)
 */
export async function settlePayment(
  consumerWallet: string,
  apiKeyOwnerWallet: string,
  totalSol: number
): Promise<SettlementResult> {
  const apiKeyEarnings = parseFloat((totalSol * KEY_HOLDER_RATIO).toFixed(9));
  const platformFee = parseFloat((totalSol * PLATFORM_FEE_RATIO).toFixed(9));

  if (!MAGICBLOCK_API_KEY) {
    logger.warn("MAGICBLOCK_API_KEY not set — using simulated settlement");
    return simulatedSettlement(apiKeyOwnerWallet, apiKeyEarnings, platformFee);
  }

  try {
    const response = await fetch(`${MAGICBLOCK_API_BASE}/private-transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MAGICBLOCK_API_KEY}`,
        "X-Network": process.env.MAGICBLOCK_NETWORK ?? "mainnet",
      },
      body: JSON.stringify({
        from: consumerWallet,
        transfers: [
          { to: apiKeyOwnerWallet, amount: apiKeyEarnings.toString(), token: "SOL" },
          { to: PLATFORM_WALLET, amount: platformFee.toString(), token: "SOL" },
        ],
        metadata: { source: "x402-umbra-backend" },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MagicBlock API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { transactionId: string };

    logger.info("MagicBlock settlement submitted", {
      txId: data.transactionId,
      apiKeyOwner: apiKeyOwnerWallet,
      apiKeyEarnings,
      platformFee,
    });

    return {
      settlementSignature: data.transactionId,
      apiKeyOwner: apiKeyOwnerWallet,
      apiKeyEarnings,
      platformFee,
      method: "magicblock-tee",
    };
  } catch (err) {
    logger.error("MagicBlock settlement failed — falling back to simulation", {
      error: (err as Error).message,
    });
    // Don't fail the whole request if settlement errors; log for reconciliation.
    return simulatedSettlement(apiKeyOwnerWallet, apiKeyEarnings, platformFee);
  }
}

function simulatedSettlement(
  apiKeyOwnerWallet: string,
  apiKeyEarnings: number,
  platformFee: number
): SettlementResult {
  const settlementSignature = `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  logger.info("Simulated settlement (no MagicBlock key)", {
    settlementSignature,
    apiKeyOwner: apiKeyOwnerWallet,
    apiKeyEarnings,
    platformFee,
  });
  return {
    settlementSignature,
    apiKeyOwner: apiKeyOwnerWallet,
    apiKeyEarnings,
    platformFee,
    method: "simulated",
  };
}
