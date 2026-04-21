/// <reference types="node" />
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
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
  console.log("Verifying the transaction..");

  const receiverPubKey = new PublicKey(params.expectedReceiver);
  const expectedAmountLamports = params.expectedAmountLamports;

  console.log("expected receiver key..", receiverPubKey);

  try {
    const paymentData = Buffer.from(params.signedTxBase64, "base64");

    console.log("Received payment proof from client..");

    // Deserialize the transaction
    let tx: Transaction;

    try {
      tx = Transaction.from(paymentData);
    } catch (err) {
      return { success: false, reason: "invalid_serialized_transaction" };
    }

    console.log("Verifying transaction instructions...");

    // Inspect and validate transfer instruction
    let validTransfer = false;
    let foundAmount = 0;

    for (const ix of tx.instructions) {
      if (ix.programId.equals(SystemProgram.programId)) {
        // system program ix-layout
        if (ix.data.length == 12 && ix.data[0] == 2) {
          const lamports = Number(ix.data.readBigInt64LE(4));
          foundAmount = lamports;

          if (
            ix.keys.length >= 2 &&
            ix.keys[1]?.pubkey.equals(receiverPubKey) &&
            lamports >= expectedAmountLamports
          ) {
            validTransfer = true;

            console.log(
              `its a valid transfer...${expectedAmountLamports} to ${receiverPubKey.toBase58()}`
            );

            break;
          }
        }
      }
    }

    if (!validTransfer) {
      return {
        success: false,
        reason:
          "transaction does not contain valid receiver address..or other..",
        foundAmount,
        expectedAmount: expectedAmountLamports,
      };
    }

    // stimulate tx..

    const messageV0 = new TransactionMessage({
      payerKey: tx.feePayer!,
      recentBlockhash: tx.recentBlockhash!,
      instructions: tx.instructions,
    }).compileToV0Message();

    // Create VersionedTransaction
    const versionedTx = new VersionedTransaction(messageV0);

    // Simulate
    console.log("Simulating transaction...");
    let simulation: any = null;
    let isAlreadyProcessed = false;

    try {
      simulation = await connection.simulateTransaction(versionedTx);
      
      // Check if simulation failed because it's already processed (in the return value)
      if (simulation.value.err && JSON.stringify(simulation.value.err).toLowerCase().includes("already been processed")) {
        isAlreadyProcessed = true;
      }
    } catch (err: any) {
      // Check if it failed because it's already processed (as a thrown exception)
      if (err.message && err.message.toLowerCase().includes("already been processed")) {
        console.log("Simulation threw 'already processed' error. Handling gracefully.");
        isAlreadyProcessed = true;
      } else {
        // Rethrow if it's some other simulation error
        throw err;
      }
    }

    let signature: string;

    if (isAlreadyProcessed) {
      console.log("Transaction already processed on-chain. Skipping send step and jumping to verification.");
      // Derive signature from the signed transaction
      const legacyTx = Transaction.from(paymentData);
      signature = bs58.encode(legacyTx.signatures[0]!.signature!);
    } else if (simulation?.value.err) {
      console.log("logs:...", simulation.value.err);
      console.log("logs:...", simulation.value.logs);
      return {
        success: false,
        reason: "simulation_failed..",
        details: simulation.value.err,
        logs: simulation.value.logs,
      };
    } else {
      console.log("Simulation successful....");
      signature = await connection.sendRawTransaction(paymentData, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
    }

    console.log("Directing to confirmation/verification for signature:", signature);

    const confirmation = await connection.confirmTransaction(
      signature,
      "confirmed"
    );

    if (confirmation.value.err) {
      console.error("Confirmation error:", confirmation.value.err);
      return {
        success: false,
        reason: "transaction_failed_on_chain",
        details: confirmation.value.err,
        signature,
      };
    }

    // Verify post-confirmation balances with retry logic for indexing lag
    console.log("Verifying the tx post confirmation (checking for indexing lag)...");

    let confirmedTx = null;
    const maxRetries = 5;
    const retryDelay = 2000;

    for (let i = 0; i < maxRetries; i++) {
      confirmedTx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (confirmedTx) break;

      if (i < maxRetries - 1) {
        console.log(`Indexing lag detected. Retrying fetch (${i + 1}/${maxRetries})...`);
        await new Promise((res) => setTimeout(res, retryDelay));
      }
    }

    if (!confirmedTx) {
      console.error("Failed to fetch transaction after retries.");
      return {
        success: false,
        reason: "could_not_fetch_confirmed_transaction_indexing_lag",
        signature,
      };
    }

    const preBalances = confirmedTx.meta?.preBalances ?? [];
    const postBalances = confirmedTx.meta?.postBalances ?? [];
    const accountKeys = confirmedTx.transaction.message.accountKeys;

    const receiverIndex = accountKeys.findIndex((k) =>
      k.equals(receiverPubKey)
    );
    if (receiverIndex === -1) {
      return {
        success: false,
        reason: "receiver_not_found_in_transaction",
      };
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
      message: "Payment verified succesfully..",
      signature,
      exploreUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,

      received,
      expectedReceiver: receiverPubKey.toBase58(),
    };


  } catch (err: any) {
    return {
      success: false,
      reason: err.message,
    };
  }
}
