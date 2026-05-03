"use client";

import { getWallets } from "@wallet-standard/app";
import { StandardConnect } from "@wallet-standard/features";
import {
  createSignerFromWalletAccount,
  getMasterViewingKeyDeriver,
  getPublicBalanceToReceiverClaimableUtxoCreatorFunction,
  getUmbraClient,
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";
import {
  getCreateReceiverClaimableUtxoFromPublicBalanceProver,
  getUserRegistrationProver,
} from "@umbra-privacy/web-zk-prover";

type UmbraPaymentRequest = {
  receiver: string;
  amountLamports: number;
  quoteId: string | null;
  umbra: {
    mint: string;
    symbol: string;
    decimals: number;
    network: "mainnet" | "devnet" | "localnet";
    indexerApiEndpoint: string;
    treeIndex: number;
  } | null;
};

function formatError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function toWsUrl(rpcUrl: string) {
  if (rpcUrl.startsWith("https://")) {
    return rpcUrl.replace("https://", "wss://");
  }

  if (rpcUrl.startsWith("http://")) {
    return rpcUrl.replace("http://", "ws://");
  }

  return rpcUrl;
}

async function getUmbraBrowserSigner() {
  const { get } = getWallets();
  const wallets = get().filter((wallet) => {
    const featureNames = Object.keys(wallet.features);
    return (
      featureNames.includes("solana:signTransaction") &&
      featureNames.includes("solana:signMessage")
    );
  });

  const wallet = wallets[0];
  if (!wallet) {
    throw new Error("No Wallet Standard wallet with signTransaction and signMessage support found.");
  }

  const connectFeature = wallet.features[StandardConnect];
  if (!connectFeature) {
    throw new Error("Selected wallet does not support Wallet Standard connect.");
  }

  const { accounts } = await (connectFeature as any).connect();
  const account = accounts[0];
  if (!account) {
    throw new Error("Wallet connected without an active account.");
  }

  return createSignerFromWalletAccount(wallet, account);
}

export async function createUmbraPrivatePayment(params: {
  paymentRequest: UmbraPaymentRequest;
  rpcUrl: string;
}) {
  if (!params.paymentRequest.umbra) {
    throw new Error("Umbra payment metadata missing from backend quote.");
  }

  console.group("[Umbra][Frontend] createUmbraPrivatePayment");
  console.info("[Umbra][Frontend] payment request", {
    receiver: params.paymentRequest.receiver,
    amountAtomic: params.paymentRequest.amountLamports,
    quoteId: params.paymentRequest.quoteId,
    mint: params.paymentRequest.umbra.mint,
    symbol: params.paymentRequest.umbra.symbol,
    decimals: params.paymentRequest.umbra.decimals,
    network: params.paymentRequest.umbra.network,
    treeIndex: params.paymentRequest.umbra.treeIndex,
    rpcUrl: params.rpcUrl,
  });

  try {
    console.info("[Umbra][Frontend] step=getUmbraBrowserSigner:start");
    const signer = await getUmbraBrowserSigner();
    console.info("[Umbra][Frontend] step=getUmbraBrowserSigner:done", {
      signerAddress: signer.address,
    });

    console.info("[Umbra][Frontend] step=getUmbraClient:start");
    const client = await getUmbraClient({
      signer,
      network: params.paymentRequest.umbra.network,
      rpcUrl: params.rpcUrl,
      rpcSubscriptionsUrl: toWsUrl(params.rpcUrl),
      indexerApiEndpoint: params.paymentRequest.umbra.indexerApiEndpoint,
      deferMasterSeedSignature: true,
    });
    console.info("[Umbra][Frontend] step=getUmbraClient:done");

    const registrationProver = getUserRegistrationProver();
    const createUtxoProver = getCreateReceiverClaimableUtxoFromPublicBalanceProver();

    console.info("[Umbra][Frontend] step=register:start");
    const register = getUserRegistrationFunction({ client }, {
      zkProver: registrationProver,
    });
    await register({ confidential: true, anonymous: true });
    console.info("[Umbra][Frontend] step=register:done");

    console.info("[Umbra][Frontend] step=createUtxo:start", {
      destinationAddress: params.paymentRequest.receiver,
      mint: params.paymentRequest.umbra.mint,
      amountAtomic: params.paymentRequest.amountLamports,
    });
    const createUtxo = getPublicBalanceToReceiverClaimableUtxoCreatorFunction(
      { client },
      { zkProver: createUtxoProver }
    );

    const signatures = await createUtxo({
      destinationAddress: params.paymentRequest.receiver as any,
      mint: params.paymentRequest.umbra.mint as any,
      amount: BigInt(params.paymentRequest.amountLamports) as any,
    });
    console.info("[Umbra][Frontend] step=createUtxo:done", { signatures });

    console.info("[Umbra][Frontend] step=deriveViewingKey:start");
    const deriveMasterViewingKey = getMasterViewingKeyDeriver({ client });
    const viewingKey = await deriveMasterViewingKey();
    console.info("[Umbra][Frontend] step=deriveViewingKey:done");

    return {
      quoteId: params.paymentRequest.quoteId || "",
      txSignatures: signatures,
      viewingKey: viewingKey.toString(),
    };
  } catch (error) {
    console.error("[Umbra][Frontend] createUmbraPrivatePayment failed", formatError(error));
    throw error;
  } finally {
    console.groupEnd();
  }
}
