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
import { getClientTraceId, getRequestId, logError, logInfo, logWarn } from "../utils/logging";

export const premiumRouter: Router = Router();

premiumRouter.post("/", validatePremiumBody, async (req: express.Request, res: express.Response) => {
  const requestId = getRequestId(res);
  const clientTraceId = getClientTraceId(res);

  try {
    const { model, prompt, paymentMethod = "standard" } = req.body;
    logInfo("PremiumRoute", "request.received", {
      requestId,
      clientTraceId,
      paymentMethod,
      model,
      hasQuoteId: Boolean(req.body.quoteId),
      hasSignedTx: Boolean(req.headers["x402-signed-tx"]),
    });

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

      const quoteId = typeof req.body.quoteId === "string" ? req.body.quoteId : null;

      if (!quoteId) {
        logInfo("PremiumRoute", "umbra.quote.requested", {
          requestId,
          clientTraceId,
          model: aiModel,
          amountAtomic: rateUsdc,
          mint: ENV.UMBRA_MINT_ADDRESS,
          symbol: ENV.UMBRA_MINT_SYMBOL,
          network: ENV.UMBRA_NETWORK,
        });
        await ensureUmbraPlatformRegistration();

        const quote = createUmbraQuote({
          receiver: umbraReceiver,
          baseAmountAtomic: rateUsdc,
          traceId: requestId,
        });

        return res.status(402).json({
          traceId: requestId,
          message: "Private payment required",
          paymentRequest: createPaymentRequest({
            receiver: umbraReceiver,
            amountLamports: quote.amountAtomic,
            memo: `private payment for model:${aiModel}`,
            expiresInSec: 300,
            paymentMethod: "umbra",
            currency: ENV.UMBRA_MINT_SYMBOL as "dUSDC",
            quoteId: quote.quoteId,
            txId: quote.txId,
            umbra: {
              mint: ENV.UMBRA_MINT_ADDRESS,
              symbol: ENV.UMBRA_MINT_SYMBOL,
              decimals: ENV.UMBRA_MINT_DECIMALS,
              network: ENV.UMBRA_NETWORK,
              indexerApiEndpoint: ENV.UMBRA_INDEXER_API_ENDPOINT,
              treeIndex: ENV.UMBRA_TREE_INDEX,
            },
          }),
        });
      }

      const umbraVerification = await verifyUmbraPayment({
        quoteId,
        txId: typeof req.body.txId === "string" ? req.body.txId : null,
        callbackSignature:
          typeof req.body.callbackSignature === "string" ? req.body.callbackSignature : null,
        paymentSignatures: Array.isArray(req.body.paymentSignatures)
          ? req.body.paymentSignatures.filter((value: unknown): value is string => typeof value === "string")
          : [],
        traceId: requestId,
      });

      if (!umbraVerification.success) {
        logWarn("PremiumRoute", "umbra.verification.failed", {
          requestId,
          clientTraceId,
          quoteId,
          reason: umbraVerification.reason,
        });
        return res.status(400).json({
          traceId: requestId,
          error: "umbra payment verification failed",
          details: umbraVerification.reason,
        });
      }

      logInfo("PremiumRoute", "umbra.verification.succeeded", {
        requestId,
        clientTraceId,
        quoteId,
        verifiedSignature: umbraVerification.verifiedSignature,
        amountAtomic: umbraVerification.amountAtomic,
      });

      const aiResponse = await callModel_Api({
        model: aiModel,
        prompt,
        api_key,
      });

      return res.json({
        traceId: requestId,
        paidTxSignature: umbraVerification.verifiedSignature,
        ai: aiResponse,
        payment: {
          method: "umbra",
          quoteId: umbraVerification.quoteId,
          txId: umbraVerification.txId,
          amountAtomic: umbraVerification.amountAtomic,
          currency: ENV.UMBRA_MINT_SYMBOL as "dUSDC",
          mint: ENV.UMBRA_MINT_ADDRESS,
          decimals: ENV.UMBRA_MINT_DECIMALS,
          destinationAddress: umbraVerification.destinationAddress,
          verifiedSignature: umbraVerification.verifiedSignature,
          timestamp: umbraVerification.timestamp,
        },
      });
    }

    const signedTxBase64 = (req.headers["x402-signed-tx"] as string) || null;
    if (!signedTxBase64) {
      return res.status(402).json({
        traceId: requestId,
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
        traceId: requestId,
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
      traceId: requestId,
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
    logError("PremiumRoute", "request.failed", {
      requestId,
      clientTraceId,
      message: (err as Error).message,
      stack: (err as Error).stack,
    });
    return res
      .status(500)
      .json({ traceId: requestId, error: "internal_error", details: (err as Error).message });
  }
});
