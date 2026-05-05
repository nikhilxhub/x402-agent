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
import { createOptionalData32 } from "@umbra-privacy/sdk/utils";
import {
  getCreateReceiverClaimableUtxoFromPublicBalanceProver,
  getUserRegistrationProver,
} from "@umbra-privacy/web-zk-prover";

type UmbraPaymentRequest = {
  receiver: string;
  amountLamports: number;
  quoteId: string | null;
  txId: string | null;
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

async function getUmbraBrowserSigner(connectedAddress?: string) {
  const { get } = getWallets();
  const wallets = get().filter((wallet) => {
    const featureNames = Object.keys(wallet.features);
    return (
      featureNames.includes("solana:signTransaction") &&
      featureNames.includes("solana:signMessage")
    );
  });
  console.info("[Umbra][Frontend] wallet-standard.discovery", {
    connectedAddress,
    walletCount: wallets.length,
    wallets: wallets.map((wallet) => ({
      name: wallet.name,
      accounts: wallet.accounts.map((account) => account.address),
      features: Object.keys(wallet.features),
    })),
  });

  // If an address is provided, try to find the wallet that has that account.
  // Otherwise fall back to the first discovered wallet (old behavior, risky).
  const wallet = connectedAddress
    ? wallets.find((w) => w.accounts.some((a) => a.address === connectedAddress))
    : wallets[0];

  if (!wallet) {
    throw new Error(
      `No Wallet Standard wallet with signTransaction and signMessage support found${
        connectedAddress ? ` for address ${connectedAddress}` : ""
      }.`
    );
  }

  const connectFeature = wallet.features[StandardConnect];
  if (!connectFeature) {
    throw new Error("Selected wallet does not support Wallet Standard connect.");
  }

  console.info("[Umbra][Frontend] wallet-standard.selected", {
    walletName: wallet.name,
    connectedAddress,
    availableAccounts: wallet.accounts.map((account) => account.address),
  });
  const { accounts } = await (connectFeature as any).connect();
  console.info("[Umbra][Frontend] wallet-standard.connect_result", {
    walletName: wallet.name,
    returnedAccounts: accounts.map((account: any) => account.address),
  });

  // Use the account that matches the connected address if provided
  const account = connectedAddress
    ? accounts.find((a: any) => a.address === connectedAddress)
    : accounts[0];

  if (!account) {
    throw new Error("Wallet connected without an active account.");
  }

  return createSignerFromWalletAccount(wallet, account);
}

export async function createUmbraPrivatePayment(params: {
  paymentRequest: UmbraPaymentRequest;
  rpcUrl: string;
  connectedAddress?: string;
  traceId?: string;
}) {
  if (!params.paymentRequest.umbra) {
    throw new Error("Umbra payment metadata missing from backend quote.");
  }
  if (!params.paymentRequest.txId) {
    throw new Error("Umbra txId missing from backend quote.");
  }

  console.group("[Umbra][Frontend] createUmbraPrivatePayment");
  console.info("[Umbra][Frontend] payment request", {
    traceId: params.traceId,
    receiver: params.paymentRequest.receiver,
    amountAtomic: params.paymentRequest.amountLamports,
    quoteId: params.paymentRequest.quoteId,
    txId: params.paymentRequest.txId,
    mint: params.paymentRequest.umbra.mint,
    symbol: params.paymentRequest.umbra.symbol,
    decimals: params.paymentRequest.umbra.decimals,
    network: params.paymentRequest.umbra.network,
    treeIndex: params.paymentRequest.umbra.treeIndex,
    rpcUrl: params.rpcUrl,
    connectedAddress: params.connectedAddress,
  });

  try {
    console.info("[Umbra][Frontend] step=getUmbraBrowserSigner:start", {
      traceId: params.traceId,
    });
    const signer = await getUmbraBrowserSigner(params.connectedAddress);
    console.info("[Umbra][Frontend] step=getUmbraBrowserSigner:done", {
      traceId: params.traceId,
      signerAddress: signer.address,
    });

    console.info("[Umbra][Frontend] step=getUmbraClient:start", {
      traceId: params.traceId,
    });
    const client = await getUmbraClient({
      signer,
      network: params.paymentRequest.umbra.network,
      rpcUrl: params.rpcUrl,
      rpcSubscriptionsUrl: toWsUrl(params.rpcUrl),
      indexerApiEndpoint: params.paymentRequest.umbra.indexerApiEndpoint,
      deferMasterSeedSignature: true,
    });
    console.info("[Umbra][Frontend] step=getUmbraClient:done", {
      traceId: params.traceId,
    });

    const registrationProver = getUserRegistrationProver();
    const createUtxoProver = getCreateReceiverClaimableUtxoFromPublicBalanceProver();

    console.info("[Umbra][Frontend] step=register:start", {
      traceId: params.traceId,
    });
    const register = getUserRegistrationFunction({ client }, {
      zkProver: registrationProver,
    });
    await register({ confidential: true, anonymous: true });
    console.info("[Umbra][Frontend] step=register:done", {
      traceId: params.traceId,
    });

    console.info("[Umbra][Frontend] step=createUtxo:start", {
      traceId: params.traceId,
      destinationAddress: params.paymentRequest.receiver,
      mint: params.paymentRequest.umbra.mint,
      amountAtomic: params.paymentRequest.amountLamports,
    });
    const createUtxo = getPublicBalanceToReceiverClaimableUtxoCreatorFunction(
      { client },
      { zkProver: createUtxoProver }
    );
    const txIdBytes = Uint8Array.from(
      atob(params.paymentRequest.txId),
      (char) => char.charCodeAt(0)
    );
    const optionalData = createOptionalData32(txIdBytes, "paymentTxId");

    const createUtxoResult = await createUtxo({
      destinationAddress: params.paymentRequest.receiver as any,
      mint: params.paymentRequest.umbra.mint as any,
      amount: BigInt(params.paymentRequest.amountLamports) as any,
    }, {
      optionalData,
    });
    const txSignatures = [
      createUtxoResult.createProofAccountSignature,
      createUtxoResult.createUtxoSignature,
      ...(createUtxoResult.closeProofAccountSignature
        ? [createUtxoResult.closeProofAccountSignature]
        : []),
    ];
    console.info("[Umbra][Frontend] step=createUtxo:done", {
      traceId: params.traceId,
      createProofAccountSignature: createUtxoResult.createProofAccountSignature,
      createUtxoSignature: createUtxoResult.createUtxoSignature,
      closeProofAccountSignature: createUtxoResult.closeProofAccountSignature,
      txSignatures,
    });

    console.info("[Umbra][Frontend] step=deriveViewingKey:start", {
      traceId: params.traceId,
    });
    const deriveMasterViewingKey = getMasterViewingKeyDeriver({ client });
    const viewingKey = await deriveMasterViewingKey();
    console.info("[Umbra][Frontend] step=deriveViewingKey:done", {
      traceId: params.traceId,
    });

    return {
      quoteId: params.paymentRequest.quoteId || "",
      txId: params.paymentRequest.txId,
      txSignatures,
      paymentSignature: createUtxoResult.createUtxoSignature,
      viewingKey: viewingKey.toString(),
    };
  } catch (error) {
    console.error("[Umbra][Frontend] createUmbraPrivatePayment failed", {
      traceId: params.traceId,
      ...formatError(error),
    });
    throw error;
  } finally {
    console.groupEnd();
  }
}
