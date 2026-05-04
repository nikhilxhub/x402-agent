import { createRequire } from "module";
import { randomBytes, randomUUID } from "crypto";
import bs58 from "bs58";
import { Connection, Keypair } from "@solana/web3.js";
import { ENV } from "../config/env";

type UmbraQuote = {
  quoteId: string;
  receiver: string;
  amountAtomic: number;
  txId: string;
  txIdBytes: Uint8Array;
  createdAt: number;
  used: boolean;
};

type UmbraVerificationResult =
  | {
      success: true;
      quoteId: string;
      txId: string;
      amountAtomic: number;
      destinationAddress: string;
      verifiedSignature: string;
      timestamp: string;
    }
  | {
      success: false;
      reason: string;
    };

type PublicBalanceDepositDecoder = {
  decode: (data: Uint8Array) => {
    optionalData: { first: Uint8Array };
    transferAmount: { first: bigint };
  };
};

type UmbraCodamaModule = {
  UMBRA_PROGRAM_ADDRESS: string;
  getDepositIntoStealthPoolFromPublicBalanceInstructionDataDecoder: () => PublicBalanceDepositDecoder;
};

const quoteStore = new Map<string, UmbraQuote>();

function loadUmbraCodama(): UmbraCodamaModule {
  const sdkEntryPoint = require.resolve("@umbra-privacy/sdk");
  const sdkRequire = createRequire(sdkEntryPoint);

  return sdkRequire("@umbra-privacy/umbra-codama") as UmbraCodamaModule;
}

function parseSecretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();

  if (!trimmed) {
    throw new Error("UMBRA_PLATFORM_PRIVATE_KEY not configured");
  }

  if (trimmed.startsWith("[")) {
    return new Uint8Array(JSON.parse(trimmed) as number[]);
  }

  return bs58.decode(trimmed);
}

function require64ByteKeypair(bytes: Uint8Array): Uint8Array {
  if (bytes.length !== 64) {
    throw new Error(
      `UMBRA_PLATFORM_PRIVATE_KEY decoded to ${bytes.length} bytes; it must be exactly 64 bytes. ` +
        `You likely set your wallet ADDRESS (32 bytes) instead of your private key. ` +
        `Export the full keypair: run 'solana-keygen new --outfile platform.json' and paste the JSON array, ` +
        `or export from Phantom (Settings > Security & Privacy > Export Private Key).`
    );
  }
  return bytes;
}

export function getUmbraPlatformAddress() {
  if (!ENV.UMBRA_PLATFORM_PRIVATE_KEY) {
    return null;
  }

  return Keypair.fromSecretKey(
    require64ByteKeypair(parseSecretKey(ENV.UMBRA_PLATFORM_PRIVATE_KEY))
  ).publicKey.toBase58();
}

export async function ensureUmbraPlatformRegistration() {
  if (!ENV.UMBRA_PLATFORM_PRIVATE_KEY) {
    throw new Error("UMBRA_PLATFORM_PRIVATE_KEY not configured");
  }
}

export function createUmbraQuote(params: {
  receiver: string;
  baseAmountAtomic: number;
}) {
  const quoteId = randomUUID();
  const txIdBytes = randomBytes(32);

  const quote: UmbraQuote = {
    quoteId,
    receiver: params.receiver,
    amountAtomic: params.baseAmountAtomic,
    txId: txIdBytes.toString("base64"),
    txIdBytes,
    createdAt: Date.now(),
    used: false,
  };

  quoteStore.set(quoteId, quote);
  console.log("[Umbra][Backend] quote created", {
    quoteId: quote.quoteId,
    receiver: quote.receiver,
    amountAtomic: quote.amountAtomic,
    txId: quote.txId,
    mint: ENV.UMBRA_MINT_ADDRESS,
    symbol: ENV.UMBRA_MINT_SYMBOL,
    decimals: ENV.UMBRA_MINT_DECIMALS,
  });
  return quote;
}

function getUmbraQuote(quoteId: string | null | undefined) {
  if (!quoteId) {
    return null;
  }

  const quote = quoteStore.get(quoteId) || null;
  if (!quote) {
    return null;
  }

  if (Date.now() - quote.createdAt > 5 * 60 * 1000) {
    quoteStore.delete(quoteId);
    return null;
  }

  return quote;
}

function buffersEqual(left: Uint8Array, right: Uint8Array) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right)) === 0;
}

export async function verifyUmbraPayment(params: {
  quoteId: string;
  txId: string | null;
  callbackSignature: string | null;
  paymentSignatures: string[];
}): Promise<UmbraVerificationResult> {
  console.log("[Umbra][Backend] verify start", {
    quoteId: params.quoteId,
    txId: params.txId,
    callbackSignature: params.callbackSignature,
    paymentSignatures: params.paymentSignatures,
    mint: ENV.UMBRA_MINT_ADDRESS,
  });

  const quote = getUmbraQuote(params.quoteId);

  if (!quote) {
    console.warn("[Umbra][Backend] verify failed: quote missing or expired", {
      quoteId: params.quoteId,
    });
    return { success: false, reason: "quote_not_found_or_expired" };
  }

  if (quote.used) {
    console.warn("[Umbra][Backend] verify failed: quote already used", {
      quoteId: params.quoteId,
    });
    return { success: false, reason: "quote_already_used" };
  }

  if (params.txId !== quote.txId) {
    console.warn("[Umbra][Backend] verify failed: txId mismatch", {
      quoteId: params.quoteId,
      expectedTxId: quote.txId,
      submittedTxId: params.txId,
    });
    return { success: false, reason: "optional_data_mismatch" };
  }

  const signaturesToCheck = [
    ...(params.callbackSignature ? [params.callbackSignature] : []),
    ...params.paymentSignatures,
  ].filter(
    (signature, index, array) =>
      signature.length > 0 && array.indexOf(signature) === index
  );

  if (signaturesToCheck.length === 0) {
    console.warn("[Umbra][Backend] verify failed: no payment signatures supplied", {
      quoteId: params.quoteId,
    });
    return { success: false, reason: "payment_signature_missing" };
  }

  const {
    UMBRA_PROGRAM_ADDRESS,
    getDepositIntoStealthPoolFromPublicBalanceInstructionDataDecoder,
  } = loadUmbraCodama();
  const connection = new Connection(ENV.SOLANA_RPC_URL, "confirmed");
  const decoder = getDepositIntoStealthPoolFromPublicBalanceInstructionDataDecoder();

  for (const signature of signaturesToCheck) {
    const transaction = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction || transaction.meta?.err) {
      continue;
    }

    for (const instruction of transaction.transaction.message.instructions) {
      if (
        !("programId" in instruction) ||
        instruction.programId.toBase58() !== UMBRA_PROGRAM_ADDRESS
      ) {
        continue;
      }

      if (!("data" in instruction) || typeof instruction.data !== "string") {
        continue;
      }

      try {
        const decoded = decoder.decode(bs58.decode(instruction.data));
        const instructionOptionalData = decoded.optionalData.first;

        console.log("[Umbra][Backend] decoded payment instruction", {
          quoteId: params.quoteId,
          signature,
          transferAmount: decoded.transferAmount.first.toString(),
          optionalDataBase64: Buffer.from(instructionOptionalData).toString("base64"),
        });

        if (!buffersEqual(instructionOptionalData, quote.txIdBytes)) {
          continue;
        }

        if (decoded.transferAmount.first !== BigInt(quote.amountAtomic)) {
          console.warn("[Umbra][Backend] verify failed: amount mismatch", {
            quoteId: params.quoteId,
            signature,
            expectedAmountAtomic: quote.amountAtomic,
            actualTransferAmount: decoded.transferAmount.first.toString(),
          });
          return { success: false, reason: "payment_amount_mismatch" };
        }

        quote.used = true;
        const timestamp = new Date(
          (transaction.blockTime ?? Math.floor(Date.now() / 1000)) * 1000
        ).toISOString();

        console.log("[Umbra][Backend] verify success", {
          quoteId: quote.quoteId,
          verifiedSignature: signature,
          amountAtomic: quote.amountAtomic,
        });

        return {
          success: true,
          quoteId: quote.quoteId,
          txId: quote.txId,
          amountAtomic: quote.amountAtomic,
          destinationAddress: quote.receiver,
          verifiedSignature: signature,
          timestamp,
        };
      } catch (error) {
        console.warn("[Umbra][Backend] instruction decode skipped", {
          quoteId: params.quoteId,
          signature,
          message: (error as Error).message,
        });
      }
    }
  }

  console.warn("[Umbra][Backend] verify failed: no matching payment instruction", {
    quoteId: params.quoteId,
    signaturesChecked: signaturesToCheck,
    expectedAmountAtomic: quote.amountAtomic,
  });
  return { success: false, reason: "matching_umbra_payment_not_found" };
}
