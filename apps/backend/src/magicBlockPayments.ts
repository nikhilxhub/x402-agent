/**
 * MagicBlock Private Payments integration.
 *
 * MagicBlock's SPL Private Payments API builds unsigned Solana transactions for
 * private SPL token (USDC) transfers between wallets, with no visible on-chain
 * link between payer and recipient.
 *
 * Key facts from the official API (https://payments.magicblock.app/reference):
 *  - NO API KEY required — authentication is via wallet signatures on transactions
 *  - API returns unsigned transactions (base64) that you sign and submit yourself
 *  - Works with SPL tokens (defaults to USDC), not native SOL
 *  - `sendTo` in response tells you whether to submit to Solana base chain or
 *    MagicBlock's ephemeral RPC
 *
 * Settlement flow:
 *  1. POST /v1/spl/transfer → unsigned transaction (base64)
 *  2. Sign with platform wallet keypair (PLATFORM_WALLET_PRIVATE_KEY)
 *  3. Submit to Solana base RPC or MagicBlock TEE RPC (based on `sendTo`)
 */
import { Connection, Transaction, Keypair, clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";
import { logger } from "./utils/logger";

const MAGICBLOCK_BASE = "https://payments.magicblock.app";
const PLATFORM_WALLET = process.env.PLATFORM_WALLET ?? "";
// Base58-encoded private key for the platform wallet (used to sign settlement txs)
const PLATFORM_WALLET_PRIVATE_KEY = process.env.PLATFORM_WALLET_PRIVATE_KEY ?? "";
const MAGICBLOCK_NETWORK = (process.env.MAGICBLOCK_NETWORK ?? "devnet") as "mainnet" | "devnet";

// USDC mint addresses (MagicBlock's defaults from their API spec)
// Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v  (official USDC)
// Devnet:  4zMMC9srt5Ri5X14YQuhg8UTZMMzDdKhmkZMECCzk57   (MagicBlock devnet USDC)
const MAGICBLOCK_USDC_MINT =
  process.env.MAGICBLOCK_USDC_MINT ??
  (MAGICBLOCK_NETWORK === "mainnet"
    ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : "4zMMC9srt5Ri5X14YQuhg8UTZMMzDdKhmkZMECCzk57");

const PLATFORM_FEE_RATIO = 0.2; // 20% platform fee
const KEY_HOLDER_RATIO = 0.8;   // 80% to API key holder

export interface SettlementResult {
  settlementSignature: string;
  apiKeyOwner: string;
  apiKeyEarnings: number; // in SOL
  platformFee: number;    // in SOL
  method: "magicblock-private" | "simulated";
}

/**
 * Settles a request payment via MagicBlock private USDC transfers.
 *
 * Requires PLATFORM_WALLET_PRIVATE_KEY to sign the unsigned transaction
 * returned by MagicBlock. Falls back to simulated settlement when not set.
 *
 * Amount note: converts SOL payment to USDC base units at 1:1 for simplicity.
 * In production, replace with a price oracle for accurate SOL → USDC conversion.
 */
export async function settlePayment(
  _consumerWallet: string,
  apiKeyOwnerWallet: string,
  totalSol: number
): Promise<SettlementResult> {
  const apiKeyEarnings = parseFloat((totalSol * KEY_HOLDER_RATIO).toFixed(9));
  const platformFee = parseFloat((totalSol * PLATFORM_FEE_RATIO).toFixed(9));

  if (!PLATFORM_WALLET_PRIVATE_KEY) {
    logger.warn("PLATFORM_WALLET_PRIVATE_KEY not set — using simulated settlement");
    return simulatedSettlement(apiKeyOwnerWallet, apiKeyEarnings, platformFee);
  }

  try {
    // Convert SOL earnings to USDC base units (6 decimals).
    // 0.008 SOL → 8,000 units (treated as 0.008 USDC at 1:1 — use oracle in prod)
    const earningsUsdcUnits = Math.max(1, Math.round(apiKeyEarnings * 1_000_000));

    // Step 1: Request unsigned transfer transaction from MagicBlock (no auth header needed)
    const response = await fetch(`${MAGICBLOCK_BASE}/v1/spl/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: PLATFORM_WALLET,
        to: apiKeyOwnerWallet,
        mint: MAGICBLOCK_USDC_MINT,
        amount: earningsUsdcUnits,
        visibility: "private",
        fromBalance: "base",
        toBalance: "base",
        cluster: MAGICBLOCK_NETWORK,
        memo: "x402-umbra-settlement",
        initIfMissing: true,
        initAtasIfMissing: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MagicBlock API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      transactionBase64: string;
      sendTo: "base" | "ephemeral";
    };

    // Step 2: Deserialize the unsigned transaction, sign with platform keypair
    const keypair = Keypair.fromSecretKey(bs58.decode(PLATFORM_WALLET_PRIVATE_KEY));
    const tx = Transaction.from(Buffer.from(data.transactionBase64, "base64"));
    tx.partialSign(keypair);

    // Step 3: Submit to the correct RPC based on MagicBlock's sendTo hint
    const rpcUrl = getRpcUrl(data.sendTo);
    const connection = new Connection(rpcUrl, "confirmed");
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });

    logger.info("MagicBlock private settlement submitted", {
      signature,
      apiKeyOwner: apiKeyOwnerWallet,
      apiKeyEarnings,
      platformFee,
      sendTo: data.sendTo,
    });

    return {
      settlementSignature: signature,
      apiKeyOwner: apiKeyOwnerWallet,
      apiKeyEarnings,
      platformFee,
      method: "magicblock-private",
    };
  } catch (err) {
    logger.error("MagicBlock settlement failed — falling back to simulation", {
      error: (err as Error).message,
    });
    return simulatedSettlement(apiKeyOwnerWallet, apiKeyEarnings, platformFee);
  }
}

/**
 * Returns the correct Solana RPC URL based on MagicBlock's sendTo response field.
 * "base"     → regular Solana RPC (SOLANA_RPC env or cluster default)
 * "ephemeral" → MagicBlock's TEE RPC (MAGICBLOCK_EPHEMERAL_RPC env or default)
 */
function getRpcUrl(sendTo: "base" | "ephemeral"): string {
  if (sendTo === "ephemeral") {
    if (process.env.MAGICBLOCK_EPHEMERAL_RPC) return process.env.MAGICBLOCK_EPHEMERAL_RPC;
    return MAGICBLOCK_NETWORK === "mainnet"
      ? "https://mainnet-tee.magicblock.app"
      : "https://devnet-tee.magicblock.app";
  }
  const cluster = MAGICBLOCK_NETWORK === "mainnet" ? "mainnet-beta" : "devnet";
  return process.env.SOLANA_RPC ?? clusterApiUrl(cluster);
}

function simulatedSettlement(
  apiKeyOwnerWallet: string,
  apiKeyEarnings: number,
  platformFee: number
): SettlementResult {
  const settlementSignature = `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  logger.info("Simulated settlement (PLATFORM_WALLET_PRIVATE_KEY not configured)", {
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
