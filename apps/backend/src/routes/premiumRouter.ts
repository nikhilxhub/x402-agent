import express, { Router } from "express";
import { validatePremiumBody } from "../middleware/requestValidation";
import { findApiKeyToModel2 } from "../db/prisma";
import { createPaymentRequest } from "../services/paymentService";
import { verifyAndSendSignedTransaction } from "../services/verifyAndSendSignedTransaction";
import { callModel_Api } from "../services/aiService";
import {
  createUmbraQuote,
  ensureUmbraPlatformRegistration,
  getUmbraPlatformAddress,
  verifyUmbraPayment,
} from "../services/umbraService";
import { ENV } from "../config/env";

export const premiumRouter: Router = Router();

premiumRouter.post("/", validatePremiumBody, async (req: express.Request, res: express.Response) => {
  try {
    const { model, prompt, paymentMethod = "standard" } = req.body;

    const apiKeyEntry = await findApiKeyToModel2(model);
    if (!apiKeyEntry) {
      return res.status(404).json({ error: "model/api key not found" });
    }

    const receiver = apiKeyEntry.owner_sol;
    const rateLamports = apiKeyEntry.rate_per_request;
    const rateUsdc = apiKeyEntry.rate_per_request_usdc;
    const aiModel = apiKeyEntry.ai_model;
    const api_key = apiKeyEntry.api_key;

    if (paymentMethod === "umbra") {
      const umbraReceiver = getUmbraPlatformAddress();
      if (!umbraReceiver) {
        return res.status(400).json({
          error: "umbra_unavailable",
          details: "UMBRA_PLATFORM_PRIVATE_KEY is not configured on the backend",
        });
      }

      const quoteId = (req.headers["x402-quote-id"] as string) || null;

      if (!quoteId) {
        await ensureUmbraPlatformRegistration();

        const quote = createUmbraQuote({
          receiver: umbraReceiver,
          baseAmountAtomic: rateUsdc,
        });

        return res.status(402).json({
          message: "Private payment required",
          paymentRequest: createPaymentRequest({
            receiver: umbraReceiver,
            amountLamports: quote.amountAtomic,
            memo: `private payment for model:${aiModel}`,
            expiresInSec: 300,
            paymentMethod: "umbra",
            currency: "USDC",
            quoteId: quote.quoteId,
            umbra: {
              mint: ENV.UMBRA_MINT_ADDRESS,
              network: ENV.UMBRA_NETWORK,
              indexerApiEndpoint: ENV.UMBRA_INDEXER_API_ENDPOINT,
              treeIndex: ENV.UMBRA_TREE_INDEX,
            },
          }),
        });
      }

      const umbraVerification = await verifyUmbraPayment({
        quoteId,
        expectedReceiver: umbraReceiver,
      });

      if (!umbraVerification.success) {
        return res.status(400).json({
          error: "umbra payment verification failed",
          details: umbraVerification.reason,
        });
      }

      const aiResponse = await callModel_Api({
        model: aiModel,
        prompt,
        api_key,
      });

      return res.json({
        paidTxSignature: `umbra:${umbraVerification.leafIndex}`,
        ai: aiResponse,
        payment: {
          method: "umbra",
          quoteId: umbraVerification.quoteId,
          amountAtomic: umbraVerification.amountAtomic,
          currency: "USDC",
          destinationAddress: umbraVerification.destinationAddress,
          leafIndex: umbraVerification.leafIndex,
          unlockerType: umbraVerification.unlockerType,
          timestamp: umbraVerification.timestamp,
        },
      });
    }

    const signedTxBase64 = (req.headers["x402-signed-tx"] as string) || null;
    if (!signedTxBase64) {
      return res.status(402).json({
        message: "Payment required",
        paymentRequest: createPaymentRequest({
          receiver,
          amountLamports: rateLamports,
          memo: `payment for model:${aiModel}`,
          expiresInSec: 300,
          paymentMethod: "standard",
          currency: "SOL",
        }),
      });
    }

    const verifyResult = await verifyAndSendSignedTransaction({
      signedTxBase64,
      expectedReceiver: receiver,
      expectedAmountLamports: rateLamports,
    });

    if (!verifyResult.success) {
      return res.status(400).json({
        error: "payment verification failed",
        details: verifyResult.reason,
      });
    }

    const aiResponse = await callModel_Api({
      model: aiModel,
      prompt,
      api_key,
    });

    return res.json({
      paidTxSignature: verifyResult.signature,
      ai: aiResponse,
      payment: {
        method: "standard",
        currency: "SOL",
        amountLamports: rateLamports,
        receiver,
        explorerUrl: verifyResult.exploreUrl,
      },
    });
  } catch (err) {
    console.error("premiumHandler error", err);
    return res
      .status(500)
      .json({ error: "internal_error", details: (err as Error).message });
  }
});
