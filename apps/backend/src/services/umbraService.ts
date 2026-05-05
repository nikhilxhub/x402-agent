import { createRequire } from "module";
import { randomBytes, randomUUID } from "crypto";
import bs58 from "bs58";
import { Connection, Keypair } from "@solana/web3.js";
import { ENV } from "../config/env";
import { logInfo, logWarn } from "../utils/logging";

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

type PublicStealthPoolDepositInputBufferDecoder = {
  decode: (data: Uint8Array) => {
    offset: { first: bigint };
    optionalData: { first: Uint8Array };
  };
};

type PublicBalanceDepositDecoder = {
  decode: (data: Uint8Array) => {
    publicStealthPoolDepositInputBufferOffset: { first: bigint };
    transferAmount: { first: bigint };
  };
};

type UmbraCodamaModule = {
  UMBRA_PROGRAM_ADDRESS: string;
  getCreatePublicStealthPoolDepositInputBufferInstructionDataDecoder: () => PublicStealthPoolDepositInputBufferDecoder;
  getDepositIntoStealthPoolFromPublicBalanceInstructionDataDecoder: () => PublicBalanceDepositDecoder;
};

type UmbraConstantsModule = {
  getNetworkConfig: (network: "mainnet" | "devnet" | "localnet") => {
    programId: string;
  };
};

type ParsedInstructionCandidate = {
  source: string;
  programId: string | null;
  data: string | null;
};

type BufferInstructionMatch = {
  signature: string;
  source: string;
  offset: bigint;
  optionalDataBase64: string;
};

type DepositInstructionMatch = {
  signature: string;
  source: string;
  offset: bigint;
  transferAmount: bigint;
};

const quoteStore = new Map<string, UmbraQuote>();

function loadUmbraModules() {
  const sdkEntryPoint = require.resolve("@umbra-privacy/sdk");
  const sdkRequire = createRequire(sdkEntryPoint);
  const codama = sdkRequire("@umbra-privacy/umbra-codama") as UmbraCodamaModule;
  const constants = sdkRequire("@umbra-privacy/sdk/constants") as UmbraConstantsModule;

  return {
    codama,
    constants,
  };
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
  traceId?: string;
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
  logInfo("Umbra.Backend", "quote.created", {
    traceId: params.traceId,
    quoteId: quote.quoteId,
    receiver: quote.receiver,
    amountAtomic: quote.amountAtomic,
    txId: quote.txId,
    mint: ENV.UMBRA_MINT_ADDRESS,
    symbol: ENV.UMBRA_MINT_SYMBOL,
    decimals: ENV.UMBRA_MINT_DECIMALS,
    network: ENV.UMBRA_NETWORK,
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

function normalizeProgramId(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "toBase58" in value) {
    const toBase58 = (value as { toBase58?: () => string }).toBase58;
    if (typeof toBase58 === "function") {
      return toBase58.call(value);
    }
  }

  return null;
}

function getInstructionCandidates(transaction: Awaited<ReturnType<Connection["getParsedTransaction"]>>) {
  const topLevel = transaction?.transaction.message.instructions ?? [];
  const inner = transaction?.meta?.innerInstructions ?? [];
  const candidates: ParsedInstructionCandidate[] = [];

  for (const instruction of topLevel) {
    candidates.push({
      source: "outer",
      programId: normalizeProgramId("programId" in instruction ? instruction.programId : null),
      data: "data" in instruction && typeof instruction.data === "string" ? instruction.data : null,
    });
  }

  inner.forEach((entry, entryIndex) => {
    entry.instructions.forEach((instruction, instructionIndex) => {
      candidates.push({
        source: `inner:${entryIndex}:${instructionIndex}`,
        programId: normalizeProgramId("programId" in instruction ? instruction.programId : null),
        data: "data" in instruction && typeof instruction.data === "string" ? instruction.data : null,
      });
    });
  });

  return candidates;
}

export async function verifyUmbraPayment(params: {
  quoteId: string;
  txId: string | null;
  callbackSignature: string | null;
  paymentSignatures: string[];
  traceId?: string;
}): Promise<UmbraVerificationResult> {
  logInfo("Umbra.Backend", "verify.start", {
    traceId: params.traceId,
    quoteId: params.quoteId,
    txId: params.txId,
    callbackSignature: params.callbackSignature,
    paymentSignatures: params.paymentSignatures,
    mint: ENV.UMBRA_MINT_ADDRESS,
    network: ENV.UMBRA_NETWORK,
  });

  const quote = getUmbraQuote(params.quoteId);

  if (!quote) {
    logWarn("Umbra.Backend", "verify.failed.quote_missing_or_expired", {
      traceId: params.traceId,
      quoteId: params.quoteId,
    });
    return { success: false, reason: "quote_not_found_or_expired" };
  }

  if (quote.used) {
    logWarn("Umbra.Backend", "verify.failed.quote_already_used", {
      traceId: params.traceId,
      quoteId: params.quoteId,
    });
    return { success: false, reason: "quote_already_used" };
  }

  if (params.txId !== quote.txId) {
    logWarn("Umbra.Backend", "verify.failed.txid_mismatch", {
      traceId: params.traceId,
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
    logWarn("Umbra.Backend", "verify.failed.payment_signature_missing", {
      traceId: params.traceId,
      quoteId: params.quoteId,
    });
    return { success: false, reason: "payment_signature_missing" };
  }

  const { codama, constants } = loadUmbraModules();
  const {
    getCreatePublicStealthPoolDepositInputBufferInstructionDataDecoder,
    getDepositIntoStealthPoolFromPublicBalanceInstructionDataDecoder,
  } = codama;
  const { programId: networkProgramId } = constants.getNetworkConfig(
    ENV.UMBRA_NETWORK as "mainnet" | "devnet" | "localnet"
  );
  const connection = new Connection(ENV.SOLANA_RPC_URL, "confirmed");
  const createBufferDecoder =
    getCreatePublicStealthPoolDepositInputBufferInstructionDataDecoder();
  const decoder = getDepositIntoStealthPoolFromPublicBalanceInstructionDataDecoder();
  const bufferInstructionMatches: BufferInstructionMatch[] = [];
  const depositInstructionMatches: DepositInstructionMatch[] = [];

  logInfo("Umbra.Backend", "verify.config", {
    traceId: params.traceId,
    quoteId: params.quoteId,
    network: ENV.UMBRA_NETWORK,
    rpcUrl: ENV.SOLANA_RPC_URL,
    mint: ENV.UMBRA_MINT_ADDRESS,
    expectedProgramId: networkProgramId,
    codamaDefaultProgramId: codama.UMBRA_PROGRAM_ADDRESS,
  });

  for (const signature of signaturesToCheck) {
    const transaction = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      logWarn("Umbra.Backend", "verify.signature.transaction_missing", {
        traceId: params.traceId,
        quoteId: params.quoteId,
        signature,
      });
      continue;
    }

    if (transaction.meta?.err) {
      logWarn("Umbra.Backend", "verify.signature.transaction_error", {
        traceId: params.traceId,
        quoteId: params.quoteId,
        signature,
        transactionError: transaction.meta.err,
      });
      continue;
    }

    const instructionCandidates = getInstructionCandidates(transaction);

    logInfo("Umbra.Backend", "verify.signature.inspect", {
      traceId: params.traceId,
      quoteId: params.quoteId,
      signature,
      blockTime: transaction.blockTime,
      instructionCount: instructionCandidates.length,
      programIds: instructionCandidates.map((candidate) => candidate.programId),
    });

    for (const instruction of instructionCandidates) {
      if (instruction.programId !== networkProgramId) {
        continue;
      }

      if (!instruction.data) {
        logWarn("Umbra.Backend", "verify.instruction.missing_data", {
          traceId: params.traceId,
          quoteId: params.quoteId,
          signature,
          source: instruction.source,
          programId: instruction.programId,
        });
        continue;
      }

      const instructionBytes = bs58.decode(instruction.data);

      try {
        const decoded = createBufferDecoder.decode(instructionBytes);
        const optionalDataBase64 = Buffer.from(decoded.optionalData.first).toString("base64");

        bufferInstructionMatches.push({
          signature,
          source: instruction.source,
          offset: decoded.offset.first,
          optionalDataBase64,
        });

        logInfo("Umbra.Backend", "verify.buffer_instruction.decoded", {
          traceId: params.traceId,
          quoteId: params.quoteId,
          signature,
          source: instruction.source,
          programId: instruction.programId,
          optionalDataBase64,
          expectedOptionalDataBase64: quote.txId,
          offset: decoded.offset.first.toString(),
        });
      } catch {
        // Not a create-buffer instruction, continue to the deposit decoder.
      }

      try {
        const decoded = decoder.decode(instructionBytes);

        depositInstructionMatches.push({
          signature,
          source: instruction.source,
          offset: decoded.publicStealthPoolDepositInputBufferOffset.first,
          transferAmount: decoded.transferAmount.first,
        });

        logInfo("Umbra.Backend", "verify.deposit_instruction.decoded", {
          traceId: params.traceId,
          quoteId: params.quoteId,
          signature,
          source: instruction.source,
          programId: instruction.programId,
          transferAmount: decoded.transferAmount.first.toString(),
          offset: decoded.publicStealthPoolDepositInputBufferOffset.first.toString(),
        });
      } catch (error) {
        logWarn("Umbra.Backend", "verify.instruction.decode_skipped", {
          traceId: params.traceId,
          quoteId: params.quoteId,
          signature,
          source: instruction.source,
          programId: instruction.programId,
          message: (error as Error).message,
        });
      }
    }
  }

  const matchingBuffer = bufferInstructionMatches.find((candidate) =>
    buffersEqual(Buffer.from(candidate.optionalDataBase64, "base64"), quote.txIdBytes)
  );

  if (!matchingBuffer) {
    logWarn("Umbra.Backend", "verify.failed.optional_data_not_found", {
      traceId: params.traceId,
      quoteId: params.quoteId,
      signaturesChecked: signaturesToCheck,
      expectedOptionalDataBase64: quote.txId,
      bufferInstructionMatches: bufferInstructionMatches.map((candidate) => ({
        signature: candidate.signature,
        source: candidate.source,
        offset: candidate.offset.toString(),
        optionalDataBase64: candidate.optionalDataBase64,
      })),
    });
    return { success: false, reason: "matching_umbra_payment_not_found" };
  }

  const matchingDeposit = depositInstructionMatches.find(
    (candidate) => candidate.offset === matchingBuffer.offset
  );

  if (!matchingDeposit) {
    logWarn("Umbra.Backend", "verify.failed.deposit_for_buffer_not_found", {
      traceId: params.traceId,
      quoteId: params.quoteId,
      bufferSignature: matchingBuffer.signature,
      offset: matchingBuffer.offset.toString(),
      depositInstructionMatches: depositInstructionMatches.map((candidate) => ({
        signature: candidate.signature,
        source: candidate.source,
        offset: candidate.offset.toString(),
        transferAmount: candidate.transferAmount.toString(),
      })),
    });
    return { success: false, reason: "matching_umbra_payment_not_found" };
  }

  if (matchingDeposit.transferAmount !== BigInt(quote.amountAtomic)) {
    logWarn("Umbra.Backend", "verify.failed.payment_amount_mismatch", {
      traceId: params.traceId,
      quoteId: params.quoteId,
      bufferSignature: matchingBuffer.signature,
      verifiedSignature: matchingDeposit.signature,
      expectedAmountAtomic: quote.amountAtomic,
      actualTransferAmount: matchingDeposit.transferAmount.toString(),
      offset: matchingDeposit.offset.toString(),
    });
    return { success: false, reason: "payment_amount_mismatch" };
  }

  const verifiedTransaction = await connection.getParsedTransaction(matchingDeposit.signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  quote.used = true;
  const timestamp = new Date(
    (verifiedTransaction?.blockTime ?? Math.floor(Date.now() / 1000)) * 1000
  ).toISOString();

  logInfo("Umbra.Backend", "verify.success", {
    traceId: params.traceId,
    quoteId: quote.quoteId,
    verifiedSignature: matchingDeposit.signature,
    bufferSignature: matchingBuffer.signature,
    amountAtomic: quote.amountAtomic,
    offset: matchingDeposit.offset.toString(),
  });

  return {
    success: true,
    quoteId: quote.quoteId,
    txId: quote.txId,
    amountAtomic: quote.amountAtomic,
    destinationAddress: quote.receiver,
    verifiedSignature: matchingDeposit.signature,
    timestamp,
  };
}
