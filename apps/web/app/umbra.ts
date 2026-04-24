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
    network: "mainnet" | "devnet" | "localnet";
    indexerApiEndpoint: string;
    treeIndex: number;
  } | null;
};

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

  const signer = await getUmbraBrowserSigner();
  const client = await getUmbraClient({
    signer,
    network: params.paymentRequest.umbra.network,
    rpcUrl: params.rpcUrl,
    rpcSubscriptionsUrl: toWsUrl(params.rpcUrl),
    indexerApiEndpoint: params.paymentRequest.umbra.indexerApiEndpoint,
    deferMasterSeedSignature: true,
  });

  const registrationProver = getUserRegistrationProver();
  const createUtxoProver = getCreateReceiverClaimableUtxoFromPublicBalanceProver();

  const register = getUserRegistrationFunction({ client }, {
    zkProver: registrationProver,
  });
  await register({ confidential: true, anonymous: true });

  const createUtxo = getPublicBalanceToReceiverClaimableUtxoCreatorFunction(
    { client },
    { zkProver: createUtxoProver }
  );

  const signatures = await createUtxo({
    destinationAddress: params.paymentRequest.receiver as any,
    mint: params.paymentRequest.umbra.mint as any,
    amount: BigInt(params.paymentRequest.amountLamports) as any,
  });

  const deriveMasterViewingKey = getMasterViewingKeyDeriver({ client });
  const viewingKey = await deriveMasterViewingKey();

  return {
    quoteId: params.paymentRequest.quoteId || "",
    txSignatures: signatures,
    viewingKey: viewingKey.toString(),
  };
}
