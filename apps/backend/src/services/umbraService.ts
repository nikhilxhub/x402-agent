import { randomUUID } from "crypto";
import bs58 from "bs58";
import { ENV } from "../config/env";

type UmbraQuote = {
  quoteId: string;
  receiver: string;
  amountAtomic: number;
  createdAt: number;
  used: boolean;
};

type UmbraVerificationResult =
  | {
      success: true;
      quoteId: string;
      amountAtomic: number;
      destinationAddress: string;
      leafIndex: string;
      timestamp: string;
      unlockerType: string;
    }
  | {
      success: false;
      reason: string;
    };

const quoteStore = new Map<string, UmbraQuote>();
const consumedLeafIndices = new Set<string>();
let quoteCounter = 0;
let umbraRuntimePromise: Promise<any> | null = null;

function toWsUrl(rpcUrl: string) {
  if (ENV.UMBRA_RPC_SUBSCRIPTIONS_URL) {
    return ENV.UMBRA_RPC_SUBSCRIPTIONS_URL;
  }

  if (rpcUrl.startsWith("https://")) {
    return rpcUrl.replace("https://", "wss://");
  }

  if (rpcUrl.startsWith("http://")) {
    return rpcUrl.replace("http://", "ws://");
  }

  return rpcUrl;
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

async function getUmbraRuntime() {
  if (!umbraRuntimePromise) {
    umbraRuntimePromise = (async () => {
      const sdk = await import("@umbra-privacy/sdk");
      const signer = await sdk.createSignerFromPrivateKeyBytes(
        parseSecretKey(ENV.UMBRA_PLATFORM_PRIVATE_KEY)
      );

      const client = await sdk.getUmbraClient({
        signer,
        network: ENV.UMBRA_NETWORK as "mainnet" | "devnet" | "localnet",
        rpcUrl: ENV.SOLANA_RPC_URL,
        rpcSubscriptionsUrl: toWsUrl(ENV.SOLANA_RPC_URL),
        indexerApiEndpoint: ENV.UMBRA_INDEXER_API_ENDPOINT,
        deferMasterSeedSignature: true,
      });

      const register = sdk.getUserRegistrationFunction({ client });
      await register({ confidential: true, anonymous: false });

      return {
        scanClaimable: sdk.getClaimableUtxoScannerFunction({ client }),
      };
    })();
  }

  return umbraRuntimePromise;
}

export function createUmbraQuote(params: {
  receiver: string;
  baseAmountAtomic: number;
}) {
  quoteCounter = (quoteCounter + 1) % 997;
  const quoteId = randomUUID();

  const quote: UmbraQuote = {
    quoteId,
    receiver: params.receiver,
    amountAtomic: params.baseAmountAtomic + quoteCounter + 1,
    createdAt: Date.now(),
    used: false,
  };

  quoteStore.set(quoteId, quote);
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

export async function verifyUmbraPayment(params: {
  quoteId: string;
  expectedReceiver: string;
}): Promise<UmbraVerificationResult> {
  const quote = getUmbraQuote(params.quoteId);

  if (!quote) {
    return { success: false, reason: "quote_not_found_or_expired" };
  }

  if (quote.used) {
    return { success: false, reason: "quote_already_used" };
  }

  if (!ENV.UMBRA_PLATFORM_PRIVATE_KEY) {
    return { success: false, reason: "umbra_platform_private_key_missing" };
  }

  const runtime = await getUmbraRuntime();
  const result = await runtime.scanClaimable(BigInt(ENV.UMBRA_TREE_INDEX) as any, 0n as any);

  const candidates = [
    ...(result?.received || []),
    ...(result?.publicReceived || []),
  ] as Array<{
    amount: bigint;
    destinationAddress: string;
    insertionIndex: bigint;
    unlockerType?: string;
  }>;

  const matching = candidates.find((candidate) => {
    const leafKey = candidate.insertionIndex.toString();
    return (
      candidate.destinationAddress === params.expectedReceiver &&
      Number(candidate.amount) === quote.amountAtomic &&
      !consumedLeafIndices.has(leafKey)
    );
  });

  if (!matching) {
    return { success: false, reason: "matching_umbra_utxo_not_found_yet" };
  }

  const leafIndex = matching.insertionIndex.toString();
  consumedLeafIndices.add(leafIndex);
  quote.used = true;

  const timestamp = new Date().toISOString();

  return {
    success: true,
    quoteId: quote.quoteId,
    amountAtomic: quote.amountAtomic,
    destinationAddress: matching.destinationAddress,
    leafIndex,
    timestamp,
    unlockerType: matching.unlockerType || "received",
  };
}
