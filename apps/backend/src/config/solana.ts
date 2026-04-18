import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { ENV } from "./env";

export const toPublicKey = (addr: string) => new PublicKey(addr);

export const connection = new Connection(
  ENV.SOLANA_RPC_URL || clusterApiUrl("devnet"),
  "confirmed"
);


