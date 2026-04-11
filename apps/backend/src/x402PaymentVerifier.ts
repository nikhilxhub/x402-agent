import {
  Connection,
  ParsedTransactionWithMeta,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import { logger } from "./utils/logger";
import { TimedSet } from "./utils/cache";
import { PaymentError } from "./utils/errorHandler";

export interface PaymentVerificationResult {
  valid: true;
  payer: string;
  amount: number; // in lamports
  transactionSignature: string;
}

// Keep processed signatures in-memory to prevent replay attacks.
// TTL of 24 hours; upgrade to Redis for multi-instance deployments.
const processedSignatures = new TimedSet();

const PLATFORM_WALLET = process.env.PLATFORM_WALLET ?? "";
const REQUIRED_LAMPORTS = parseInt(
  process.env.X402_PAYMENT_AMOUNT_LAMPORTS ?? "10000000",
  10
);
const SOLANA_RPC =
  process.env.SOLANA_RPC ?? clusterApiUrl("devnet");

let _connection: Connection | null = null;
function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(SOLANA_RPC, "confirmed");
  }
  return _connection;
}

/**
 * Verifies an x402 payment header containing a base64-encoded Solana transaction signature.
 *
 * Flow:
 *  1. Decode base64 header → transaction signature string
 *  2. Fetch parsed transaction from Solana RPC
 *  3. Find SOL transfer instruction to platform wallet
 *  4. Verify amount and confirmation status
 *  5. Prevent replay attacks via signature cache
 */
export async function verifyX402Payment(
  xPaymentHeader: string
): Promise<PaymentVerificationResult> {
  if (!xPaymentHeader) {
    throw new PaymentError("Missing x-payment header");
  }

  if (!PLATFORM_WALLET) {
    throw new Error("PLATFORM_WALLET environment variable is not set");
  }

  // Step 1: Decode base64 → signature string
  let signature: string;
  try {
    signature = Buffer.from(xPaymentHeader, "base64").toString("utf8").trim();
  } catch {
    throw new PaymentError("Invalid x-payment header encoding");
  }

  if (!signature || signature.length < 32) {
    throw new PaymentError("Invalid transaction signature in x-payment header");
  }

  // Step 2: Replay attack check
  if (processedSignatures.has(signature)) {
    throw new PaymentError("Transaction signature already used (replay attack)", {
      signature,
    });
  }

  logger.info("Verifying x402 payment", { signature });

  // Step 3: Fetch from Solana RPC
  const connection = getConnection();
  let tx: ParsedTransactionWithMeta | null = null;
  try {
    tx = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch (err) {
    throw new PaymentError("Failed to fetch transaction from Solana RPC", {
      signature,
      error: (err as Error).message,
    });
  }

  if (!tx) {
    throw new PaymentError("Transaction not found or not yet confirmed", {
      signature,
    });
  }

  if (tx.meta?.err) {
    throw new PaymentError("Transaction failed on-chain", {
      signature,
      txError: tx.meta.err,
    });
  }

  // Step 4: Find SOL transfer to platform wallet
  const platformPubkey = new PublicKey(PLATFORM_WALLET);
  const instructions = tx.transaction.message.instructions;
  let payer: string | null = null;
  let transferredLamports = 0;

  for (const ix of instructions) {
    if ("parsed" in ix && ix.parsed?.type === "transfer") {
      const { info } = ix.parsed as {
        info: { source: string; destination: string; lamports: number };
      };
      if (info.destination === platformPubkey.toBase58()) {
        payer = info.source;
        transferredLamports = info.lamports;
        break;
      }
    }
  }

  // Fallback: check pre/post balances for the platform wallet
  if (!payer) {
    const accountKeys = tx.transaction.message.accountKeys;
    const platformIndex = accountKeys.findIndex(
      (k) => k.pubkey.toBase58() === platformPubkey.toBase58()
    );
    if (platformIndex >= 0 && tx.meta) {
      const pre = tx.meta.preBalances[platformIndex] ?? 0;
      const post = tx.meta.postBalances[platformIndex] ?? 0;
      transferredLamports = post - pre;
      if (transferredLamports > 0 && accountKeys[0]) {
        payer = accountKeys[0].pubkey.toBase58();
      }
    }
  }

  if (!payer || transferredLamports <= 0) {
    throw new PaymentError("No SOL transfer to platform wallet found", {
      signature,
      platform: PLATFORM_WALLET,
    });
  }

  // Step 5: Verify amount
  if (transferredLamports < REQUIRED_LAMPORTS) {
    throw new PaymentError(
      `Insufficient payment: received ${transferredLamports} lamports, required ${REQUIRED_LAMPORTS}`,
      { signature, received: transferredLamports, required: REQUIRED_LAMPORTS }
    );
  }

  // Step 6: Mark as processed (24h TTL)
  processedSignatures.add(signature, 24 * 60 * 60 * 1000);

  logger.info("x402 payment verified", { signature, payer, lamports: transferredLamports });

  return {
    valid: true,
    payer,
    amount: transferredLamports,
    transactionSignature: signature,
  };
}
