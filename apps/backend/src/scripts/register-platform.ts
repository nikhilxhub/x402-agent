import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import {
  getUmbraClient,
  getUserRegistrationFunction,
  createSignerFromPrivateKeyBytes,
} from "@umbra-privacy/sdk";
import { getUserRegistrationProver } from "@umbra-privacy/web-zk-prover";
import { ENV } from "../config/env";

async function main() {
  console.log("--- Umbra Platform Registration ---");
  
  const secretKey = ENV.UMBRA_PLATFORM_PRIVATE_KEY;
  if (!secretKey) {
    console.error("Error: UMBRA_PLATFORM_PRIVATE_KEY is not set in .env");
    process.exit(1);
  }

  let keypair: Keypair;
  try {
    const decoded = bs58.decode(secretKey);
    keypair = Keypair.fromSecretKey(decoded);
  } catch (e) {
    console.error("Error: Failed to decode UMBRA_PLATFORM_PRIVATE_KEY. Ensure it is a base58 string.");
    process.exit(1);
  }

  const address = keypair.publicKey.toBase58();
  console.log("Wallet Address:", address);
  console.log("Network:", ENV.UMBRA_NETWORK);

  const signer = await createSignerFromPrivateKeyBytes(keypair.secretKey);
  
  // Construct WebSocket URL if not provided
  const rpcUrl = ENV.SOLANA_RPC_URL;
  const rpcSubscriptionsUrl = ENV.UMBRA_RPC_SUBSCRIPTIONS_URL || 
    (rpcUrl.startsWith("https://") ? rpcUrl.replace("https://", "wss://") : rpcUrl.replace("http://", "ws://"));

  console.log("Initializing Umbra Client...");
  const client = await getUmbraClient({
    signer,
    network: ENV.UMBRA_NETWORK as any,
    rpcUrl,
    rpcSubscriptionsUrl,
    indexerApiEndpoint: ENV.UMBRA_INDEXER_API_ENDPOINT,
    deferMasterSeedSignature: true, // Use deterministic seed derivation
  });

  console.log("Initializing ZK Prover...");
  const zkProver = getUserRegistrationProver();
  
  const register = getUserRegistrationFunction({ client }, { zkProver });

  console.log("Submitting registration transaction (this may take a few seconds)...");
  try {
    const signatures = await register({ confidential: true, anonymous: true });
    console.log("Success! Registration complete.");
    console.log("Signatures:", signatures);
  } catch (error: any) {
    if (error.message?.includes("already registered") || error.message?.includes("Account already exists")) {
      console.log("Note: This address is already registered on Umbra.");
    } else {
      console.error("Registration failed:", error);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
