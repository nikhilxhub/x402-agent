/// <reference types="node" />
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
dotenv.config();
import { connection } from "../config/solana";

export async function verifyAndSendSignedTransaction(params: {
  signedTxBase64: string;
  expectedReceiver: string;
  expectedAmountLamports: number;
}) {
  console.log("Verifying transaction...");

  const receiverPubKey = new PublicKey(params.expectedReceiver);
  const expectedAmountLamports = params.expectedAmountLamports;

  try {
    const paymentData = Buffer.from(params.signedTxBase64, "base64");

    let tx: Transaction;
    try {
      tx = Transaction.from(paymentData);
    } catch {
      return { success: false, reason: "invalid_serialized_transaction" };
    }

    // Validate instruction: must be a SOL transfer to the expected receiver for >= expected amount
    let validTransfer = false;
    let foundAmount = 0;

    for (const ix of tx.instructions) {
      if (ix.programId.equals(SystemProgram.programId) && ix.data.length === 12 && ix.data[0] === 2) {
        const lamports = Number(ix.data.readBigInt64LE(4));
        foundAmount = lamports;
        if (ix.keys.length >= 2 && ix.keys[1]?.pubkey.equals(receiverPubKey) && lamports >= expectedAmountLamports) {
          validTransfer = true;
          console.log(`Valid transfer: ${lamports} lamports → ${receiverPubKey.toBase58()}`);
          break;
        }
      }
    }

    if (!validTransfer) {
      return {
        success: false,
        reason: "invalid_transfer_instruction",
        foundAmount,
        expectedAmount: expectedAmountLamports,
      };
    }

    // Derive the signature from the signed transaction bytes
    const sigBytes = tx.signatures[0]?.signature;
    if (!sigBytes) {
      return { success: false, reason: "transaction_not_signed" };
    }
    const signature = bs58.encode(sigBytes);
    console.log("Transaction signature:", signature);

    // Check if already confirmed on-chain (covers retries / duplicate requests)
    let confirmed = await isConfirmedOnChain(signature);

    if (confirmed) {
      console.log("Transaction already confirmed on-chain — skipping submit.");
    } else {
      // Submit
      console.log("Submitting transaction...");
      try {
        await connection.sendRawTransaction(paymentData, { skipPreflight: true });
      } catch (sendErr: any) {
        // RPC nodes return "already processed" if the tx landed between our status check and send
        if (isAlreadyProcessedError(sendErr)) {
          console.log("sendRawTransaction: already processed — continuing to verify.");
          confirmed = true;
        } else {
          return { success: false, reason: `send_failed: ${sendErr.message}` };
        }
      }

      // Only wait for confirmation if we didn't already know it was confirmed
      if (!confirmed) {
        console.log("Waiting for confirmation...");
        const result = await connection.confirmTransaction(signature, "confirmed");
        if (result.value.err) {
          return {
            success: false,
            reason: "transaction_failed_on_chain",
            details: result.value.err,
            signature,
          };
        }
      }
    }

    // Fetch transaction details for balance verification (with retry for indexing lag)
    console.log("Fetching transaction for balance verification...");
    let confirmedTx = null;

    for (let i = 0; i < 5; i++) {
      confirmedTx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (confirmedTx) break;
      console.log(`Indexing lag — retrying (${i + 1}/5)...`);
      await new Promise((res) => setTimeout(res, 2000));
    }

    if (!confirmedTx) {
      return {
        success: false,
        reason: "could_not_fetch_confirmed_transaction_indexing_lag",
        signature,
      };
    }

    const preBalances = confirmedTx.meta?.preBalances ?? [];
    const postBalances = confirmedTx.meta?.postBalances ?? [];
    const accountKeys = confirmedTx.transaction.message
      .getAccountKeys({ accountKeysFromLookups: confirmedTx.meta?.loadedAddresses ?? undefined })
      .keySegments()
      .flat();

    const receiverIndex = accountKeys.findIndex((k) => k.equals(receiverPubKey));
    if (receiverIndex === -1) {
      return { success: false, reason: "receiver_not_found_in_transaction" };
    }

    const received = postBalances[receiverIndex]! - preBalances[receiverIndex]!;
    if (received < expectedAmountLamports) {
      return {
        success: false,
        reason: "insufficient_payment_received",
        received,
        expectedAmountLamports,
      };
    }

    return {
      success: true,
      message: "Payment verified successfully.",
      signature,
      exploreUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      received,
      expectedReceiver: receiverPubKey.toBase58(),
    };

  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}

async function isConfirmedOnChain(signature: string): Promise<boolean> {
  try {
    const res = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    const s = res.value;
    return (
      s !== null &&
      s.err === null &&
      (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")
    );
  } catch {
    return false;
  }
}

function isAlreadyProcessedError(err: any): boolean {
  const msg: string = (err?.message ?? "").toLowerCase();
  return msg.includes("already been processed") || msg.includes("alreadyprocessed");
}
