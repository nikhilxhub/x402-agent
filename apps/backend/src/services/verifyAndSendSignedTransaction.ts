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
    const simulation = await connection.simulateTransaction(versionedTx);
    // const simulation = await connection.simulateTransaction(tx);

    if (simulation.value.err) {

          console.log("logs:...", simulation.value.err);
    console.log("logs:...", simulation.value.logs);
      return {
        success: false,
        reason: "simulation_failed..",
        details: simulation.value.err,
        logs: simulation.value.logs,
      };
    }


    console.log("Simulation successful....");

    const signature = await connection.sendRawTransaction(paymentData, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    const confirmation = await connection.confirmTransaction(
      signature,
      "confirmed"
    );

    if (confirmation.value.err) {
      return {
        success: false,
        reason: "transaction_failed_on_chain",
        details: confirmation.value.err,
        signature,
      };
    }

    // Verify post-confirmation balances
    console.log("Verifying the tx postt confirmation...");


    const confirmedTx = await connection.getTransaction(signature, {
      commitment: "confirmed",
    });
    if (!confirmedTx) {
      return {
        success: false,
        reason: "could_not_fetch_confirmed_transaction",
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
