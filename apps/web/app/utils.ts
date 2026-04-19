import { Transaction } from "@solana/web3.js";

/**
 * Converts lamports to SOL string with 4 decimal places.
 */
export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

/**
 * Truncates a Solana address for display.
 * Example: 9M3y...JML
 */
export function truncateAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
}

/**
 * Serializes a signed Solana transaction to a base64 string.
 * This is used for the x402-signed-tx header.
 */
export function serializeTransactionToBase64(tx: Transaction): string {
  try {
    const serialized = tx.serialize({
      requireAllSignatures: false, // Payer signature is enough for backend verification usually
      verifySignatures: true,
    });
    return Buffer.from(serialized).toString("base64");
  } catch (error) {
    console.error("Failed to serialize transaction:", error);
    // Fallback for browser environments where Buffer might be tricky, 
    // though Next.js polyfills it.
    const serialized = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: true,
      });
    return btoa(String.fromCharCode.apply(null, Array.from(serialized)));
  }
}
