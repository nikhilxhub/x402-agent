"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { ModelChips } from "../components/ModelChips";
import { Navbar } from "../components/Navbar";
import { PromptHistory, type HistoryItem } from "../components/PromptHistory";
import { QuoteBlock } from "../components/QuoteBlock";
import { ResponseArea } from "../components/ResponseArea";
import { StatusBar } from "../components/StatusBar";
import { StepIndicator } from "../components/StepIndicator";
import { WalletBanner } from "../components/WalletBanner";
import {
  cn,
  lamportsToSol,
  serializeTransactionToBase64,
  truncateAddress,
} from "./utils";
import { useWallet } from "../providers/WalletProvider";
import { createUmbraPrivatePayment } from "./umbra";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";
const RPC_URL = clusterApiUrl("devnet");

const AVAILABLE_MODELS = [
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "OpenAI",
    priceSol: "0.001 SOL",
    priceUsdc: "1.00 dUSDC",
  },
  {
    id: "groq",
    name: "Llama 3 · Groq",
    provider: "Groq",
    priceSol: "0.0005 SOL",
    priceUsdc: "0.50 dUSDC",
  },
  {
    id: "gemini-2",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    priceSol: "0.0005 SOL",
    priceUsdc: "0.50 dUSDC",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    priceSol: "0.002 SOL",
    priceUsdc: "2.00 dUSDC",
  },
] as const;

type PaymentMethod = "standard" | "umbra";
type TokenSymbol = "SOL" | "USDC" | "USDT" | "dUSDC" | "dUSDT";

type PaymentRequest = {
  receiver: string;
  amountLamports: number;
  memo: string;
  expiresInSec: number;
  paymentMethod: PaymentMethod;
  currency: TokenSymbol;
  quoteId: string | null;
  txId: string | null;
  umbra: {
    mint: string;
    symbol: TokenSymbol;
    decimals: number;
    network: "mainnet" | "devnet" | "localnet";
    indexerApiEndpoint: string;
    treeIndex: number;
  } | null;
};

type AIResponse = {
  traceId?: string;
  paidTxSignature: string;
  ai: string;
  payment?: {
    method: PaymentMethod;
    currency: TokenSymbol;
    amountLamports?: number;
    amountAtomic?: number;
    mint?: string;
    decimals?: number;
    receiver?: string;
    explorerUrl?: string;
    destinationAddress?: string;
    txId?: string;
    verifiedSignature?: string;
    timestamp?: string;
  };
  viewingKey?: string;
};

type ErrorResponse = {
  traceId?: string;
  error?: string;
  details?: string;
};

function createTraceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `trace-${Date.now()}`;
}

function getErrorDetails(data: AIResponse | ErrorResponse | null) {
  if (!data || typeof data !== "object" || !("details" in data)) {
    return null;
  }

  return typeof data.details === "string" ? data.details : null;
}

function formatQuoteValue(quote: PaymentRequest) {
  if (quote.paymentMethod === "umbra") {
    const decimals = quote.umbra?.decimals ?? 6;
    return (quote.amountLamports / 10 ** decimals).toFixed(decimals);
  }

  return lamportsToSol(quote.amountLamports);
}

function formatQuoteAmount(quote: PaymentRequest) {
  const symbol = quote.paymentMethod === "umbra"
    ? (quote.umbra?.symbol ?? quote.currency)
    : "SOL";

  return `${formatQuoteValue(quote)} ${symbol}`;
}

function formatPrivatePaymentAmount(payment: NonNullable<AIResponse["payment"]>) {
  const decimals = payment.decimals ?? 6;
  return `${((payment.amountAtomic ?? 0) / 10 ** decimals).toFixed(decimals)} ${payment.currency}`;
}

function deriveCurrentStep(status: string, paymentQuote: PaymentRequest | null, hasResult: boolean) {
  if (hasResult || status === "Completed") {
    return 4 as const;
  }

  if (status.startsWith("Verifying")) {
    return 4 as const;
  }

  if (status.startsWith("Creating") || status.startsWith("Awaiting")) {
    return 3 as const;
  }

  if (paymentQuote) {
    return 2 as const;
  }

  return 1 as const;
}

export default function Home() {
  const { wallet, connectWallet, signTransaction, provider } = useWallet();
  const [isBooting, setIsBooting] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0]!.id);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("standard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [paymentQuote, setPaymentQuote] = useState<PaymentRequest | null>(null);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [displayedResponse, setDisplayedResponse] = useState("");
  const [isResponseStreaming, setIsResponseStreaming] = useState(false);

  const isIncognito = paymentMethod === "umbra";
  const currentStep = deriveCurrentStep(status, paymentQuote, Boolean(result));
  const selectedModelMeta = AVAILABLE_MODELS.find((model) => model.id === selectedModel) ?? AVAILABLE_MODELS[0];
  const quoteStatus = error
    ? "error"
    : result
      ? "success"
      : isSubmitting
        ? "pending"
        : null;
  const isPhantomWallet = provider?.name?.toLowerCase().includes("phantom") ?? false;

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        if (res.ok) {
          setBackendOnline(true);
        }
      } catch (err) {
        console.error("Backend health check failed", err);
        setBackendOnline(false);
      } finally {
        setIsBooting(false);
      }
    }

    checkHealth();
  }, []);

  useEffect(() => {
    if (!result?.ai) {
      setDisplayedResponse("");
      setIsResponseStreaming(false);
      return;
    }

    const characters = Array.from(result.ai);
    let index = 0;

    setDisplayedResponse("");
    setIsResponseStreaming(true);

    const timer = window.setInterval(() => {
      index += 1;
      setDisplayedResponse(characters.slice(0, index).join(""));

      if (index >= characters.length) {
        window.clearInterval(timer);
        setIsResponseStreaming(false);
      }
    }, 40);

    return () => {
      window.clearInterval(timer);
    };
  }, [result?.ai]);

  async function handleStandardPayment(paymentRequest: PaymentRequest, traceId: string) {
    if (!wallet || !signTransaction) {
      throw new Error("Wallet not connected.");
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const fromPubkey = new PublicKey(wallet);
    const toPubkey = new PublicKey(paymentRequest.receiver);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction({
      feePayer: fromPubkey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: paymentRequest.amountLamports,
      })
    );

    const signedTx = await signTransaction(transaction);
    const signedTxBase64 = serializeTransactionToBase64(signedTx);

    const finalRes = await fetch(`${BACKEND_URL}/premium`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x402-signed-tx": signedTxBase64,
        "x-client-trace-id": traceId,
      },
      body: JSON.stringify({ model: selectedModel, prompt, paymentMethod: "standard" }),
    });

    return finalRes;
  }

  async function handleUmbraPayment(paymentRequest: PaymentRequest, traceId: string) {
    const privatePayment = await createUmbraPrivatePayment({
      paymentRequest,
      rpcUrl: RPC_URL,
      connectedAddress: wallet,
      traceId,
    });

    setStatus("Verifying private payment...");
    console.info("[Premium][Frontend] verify.request", {
      traceId,
      quoteId: privatePayment.quoteId,
      txId: privatePayment.txId,
      callbackSignature: privatePayment.paymentSignature,
      paymentSignatures: privatePayment.txSignatures,
    });

    const finalRes = await fetch(`${BACKEND_URL}/premium`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-trace-id": traceId,
      },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        paymentMethod: "umbra",
        quoteId: privatePayment.quoteId,
        txId: privatePayment.txId,
        callbackSignature: privatePayment.paymentSignature,
        paymentSignatures: privatePayment.txSignatures,
      }),
    });

    const finalData = (await finalRes.json()) as AIResponse | ErrorResponse;
    console.info("[Premium][Frontend] verify.response", {
      traceId,
      status: finalRes.status,
      ok: finalRes.ok,
      backendTraceId: finalData?.traceId ?? null,
      details: getErrorDetails(finalData),
    });

    return {
      response: finalRes,
      data: {
        ...(finalData || {}),
        viewingKey: privatePayment.viewingKey,
      } as AIResponse,
    };
  }

  function addHistoryItem(traceId: string, paymentRequest: PaymentRequest) {
    const newItem: HistoryItem = {
        id: traceId,
        modelLabel: selectedModelMeta.name,
        prompt,
        cost: formatQuoteValue(paymentRequest),
        currency: paymentRequest.paymentMethod === "umbra"
          ? (paymentRequest.umbra?.symbol ?? paymentRequest.currency)
          : "SOL",
        mode: paymentRequest.paymentMethod === "umbra" ? "private" : "standard",
      };

    setHistory((previous) => [newItem, ...previous].slice(0, 10));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!wallet) {
      await connectWallet();
      return;
    }

    if (!prompt.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setResult(null);
    setPaymentQuote(null);
    setStatus("Requesting payment quote...");

    try {
      const traceId = createTraceId();
      console.group("[Premium][Frontend] submission");
      console.info("[Premium][Frontend] submission.start", {
        traceId,
        model: selectedModel,
        paymentMethod,
        wallet,
      });

      const initRes = await fetch(`${BACKEND_URL}/premium`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-trace-id": traceId,
        },
        body: JSON.stringify({ model: selectedModel, prompt, paymentMethod }),
      });

      if (initRes.status !== 402) {
        const data = await initRes.json();
        console.error("[Premium][Frontend] quote.unexpected_response", {
          traceId,
          status: initRes.status,
          body: data,
        });
        throw new Error(data.error || "Unexpected response from backend");
      }

      const quoteData = (await initRes.json()) as {
        traceId?: string;
        paymentRequest: PaymentRequest;
      };

      console.info("[Premium][Frontend] quote.response", {
        traceId,
        backendTraceId: quoteData.traceId ?? null,
        quoteId: quoteData.paymentRequest.quoteId,
        txId: quoteData.paymentRequest.txId,
        receiver: quoteData.paymentRequest.receiver,
        amountLamports: quoteData.paymentRequest.amountLamports,
        paymentMethod: quoteData.paymentRequest.paymentMethod,
      });

      const { paymentRequest } = quoteData;
      setPaymentQuote(paymentRequest);

      if (paymentMethod === "umbra") {
        setStatus("Creating private Umbra payment...");
        const { response, data } = await handleUmbraPayment(paymentRequest, traceId);

        if (!response.ok) {
          const detailMsg = getErrorDetails(data)
            ? `: ${getErrorDetails(data)}`
            : data
              ? `: ${JSON.stringify(data)}`
              : "";
          throw new Error(`Private payment verification or AI processing failed${detailMsg}`);
        }

        addHistoryItem(traceId, paymentRequest);
        setResult(data);
        setStatus("Completed");
        return;
      }

      setStatus("Awaiting signature...");
      const finalRes = await handleStandardPayment(paymentRequest, traceId);
      const finalData = (await finalRes.json()) as AIResponse;
      console.info("[Premium][Frontend] standard.response", {
        traceId,
        status: finalRes.status,
        ok: finalRes.ok,
        backendTraceId: finalData?.traceId ?? null,
      });

      if (!finalRes.ok) {
        const detailMsg = (finalData as { details?: string }).details
          ? `: ${JSON.stringify((finalData as { details?: string }).details)}`
          : "";
        throw new Error(
          `${(finalData as { error?: string }).error || "Payment verification or AI processing failed"}${detailMsg}`
        );
      }

      addHistoryItem(traceId, paymentRequest);
      setResult(finalData);
      setStatus("Completed");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Request failed";
      console.error("[Premium][Frontend] submission.failed", {
        message,
      });
      setError(message);
      setStatus("Failed");
    } finally {
      console.groupEnd();
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Navbar
        isIncognito={isIncognito}
        onToggleIncognito={() =>
          setPaymentMethod((current) => (current === "umbra" ? "standard" : "umbra"))
        }
      />

      <main className="min-h-screen bg-white pt-12">
        <div className="mx-auto max-w-[640px] px-6 py-8 sm:px-4">
          <WalletBanner isIncognito={isIncognito} />

          <div
            className={cn(
              "rounded-xl border-px p-5 transition-colors duration-[250ms] ease-in-out",
              isIncognito
                ? "border-incognito-border bg-incognito-bg"
                : "border-black/10 bg-white"
            )}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={cn(
                    "font-sans text-10 font-medium uppercase tracking-widest",
                    isIncognito ? "text-incognito-muted" : "text-muted-light"
                  )}>
                    {isIncognito ? "Private payment terminal" : "Developer payment terminal"}
                  </p>
                  <p className={cn(
                    "mt-1 font-sans text-13 font-normal",
                    isIncognito ? "text-incognito-text" : "text-muted"
                  )}>
                    {backendOnline ? "Backend online · devnet" : "Backend offline"}
                  </p>
                </div>

                {wallet ? (
                  <span className={cn(
                    "font-sans text-11 font-normal",
                    isIncognito ? "text-incognito-muted" : "text-muted-light"
                  )}>
                    {truncateAddress(wallet)}
                  </span>
                ) : null}
              </div>

              <StepIndicator currentStep={currentStep} isIncognito={isIncognito} />

              <hr className={cn("border-t-px", isIncognito ? "border-incognito-border" : "border-black/10")} />

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label
                    htmlFor="model-selector"
                    className={cn(
                      "font-sans text-13 font-medium",
                      isIncognito ? "text-incognito-text" : "text-[#1a1a1a]"
                    )}
                  >
                    Model
                  </label>
                  <div id="model-selector">
                    <ModelChips
                      models={AVAILABLE_MODELS.map((model) => ({
                        id: model.id,
                        label: model.name,
                      }))}
                      selectedModel={selectedModel}
                      onSelect={setSelectedModel}
                      isIncognito={isIncognito}
                    />
                  </div>
                  <p className={cn(
                    "font-sans text-11 font-normal",
                    isIncognito ? "text-incognito-muted" : "text-muted-light"
                  )}>
                    {selectedModelMeta.provider} · {isIncognito ? selectedModelMeta.priceUsdc : selectedModelMeta.priceSol}
                  </p>
                </div>

                <hr className={cn("border-t-px", isIncognito ? "border-incognito-border" : "border-black/10")} />

                <div className="space-y-2">
                  <label
                    htmlFor="prompt-input"
                    className={cn(
                      "font-sans text-13 font-medium",
                      isIncognito ? "text-incognito-text" : "text-[#1a1a1a]"
                    )}
                  >
                    Prompt
                  </label>
                  <textarea
                    id="prompt-input"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Enter your prompt..."
                    rows={4}
                    className={cn(
                      "w-full resize-none rounded-lg border-px px-3.5 py-3",
                      "font-sans text-13 font-normal placeholder:text-muted-light",
                      "transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2",
                      isIncognito
                        ? "border-incognito-border bg-incognito-surface text-incognito-text placeholder:text-incognito-muted focus:border-[#444444]"
                        : "border-black/10 bg-transparent text-[#1a1a1a] focus:border-black/25"
                    )}
                    disabled={isSubmitting}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || !backendOnline || !prompt.trim()}
                      className={cn(
                        "min-h-10 rounded-lg px-4 py-2 font-sans text-13 font-medium",
                        "transition-all duration-100 ease active:scale-[0.97]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                        isIncognito
                          ? "border-px border-incognito-btn-border bg-incognito-btn text-incognito-text"
                          : "bg-[#1a1a1a] text-white hover:opacity-[0.88]"
                      )}
                    >
                      {wallet
                        ? isSubmitting
                          ? status
                          : "Get quote →"
                        : "Connect wallet to continue"}
                    </button>
                  </div>
                </div>

                {paymentQuote ? (
                  <>
                    <hr className={cn("border-t-px", isIncognito ? "border-incognito-border" : "border-black/10")} />
                    <QuoteBlock
                      price={formatQuoteValue(paymentQuote)}
                      modelLabel={selectedModelMeta.name}
                      currency={paymentQuote.paymentMethod === "umbra"
                        ? (paymentQuote.umbra?.symbol ?? paymentQuote.currency)
                        : "SOL"}
                      isIncognito={isIncognito}
                      isPhantomWallet={isPhantomWallet}
                    />
                    <p className={cn(
                      "break-all font-sans text-11 font-normal",
                      isIncognito ? "text-incognito-muted" : "text-muted-light"
                    )}>
                      Quote ID: {paymentQuote.quoteId || "standard-flow"}
                    </p>
                  </>
                ) : null}

                {quoteStatus ? (
                  <>
                    <hr className={cn("border-t-px", isIncognito ? "border-incognito-border" : "border-black/10")} />
                    <StatusBar status={quoteStatus} isIncognito={isIncognito} />
                    {error ? (
                      <p className={cn(
                        "font-sans text-12 font-normal",
                        isIncognito ? "text-incognito-muted" : "text-status-error-text"
                      )}>
                        {error}
                      </p>
                    ) : null}
                  </>
                ) : null}

                {result ? (
                  <>
                    <hr className={cn("border-t-px", isIncognito ? "border-incognito-border" : "border-black/10")} />
                    <ResponseArea
                      text={displayedResponse}
                      isStreaming={isResponseStreaming}
                      isIncognito={isIncognito}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className={cn(
                          "mb-1.5 font-sans text-10 font-medium uppercase tracking-widest",
                          isIncognito ? "text-incognito-muted" : "text-muted-light"
                        )}>
                          Payment proof
                        </p>
                        <p className={cn(
                          "break-all font-sans text-11 font-normal",
                          isIncognito ? "text-incognito-text" : "text-[#1a1a1a]"
                        )}>
                          {result.payment?.verifiedSignature || result.paidTxSignature}
                        </p>
                      </div>
                      <div>
                        <p className={cn(
                          "mb-1.5 font-sans text-10 font-medium uppercase tracking-widest",
                          isIncognito ? "text-incognito-muted" : "text-muted-light"
                        )}>
                          Runtime model
                        </p>
                        <p className={cn(
                          "font-sans text-12 font-normal",
                          isIncognito ? "text-incognito-text" : "text-[#1a1a1a]"
                        )}>
                          {selectedModelMeta.name}
                        </p>
                      </div>
                      {result.payment?.method === "umbra" ? (
                        <div>
                          <p className={cn(
                            "mb-1.5 font-sans text-10 font-medium uppercase tracking-widest",
                            isIncognito ? "text-incognito-muted" : "text-muted-light"
                          )}>
                            Private payment amount
                          </p>
                          <p className={cn(
                            "font-sans text-12 font-normal",
                            isIncognito ? "text-incognito-text" : "text-[#1a1a1a]"
                          )}>
                            {formatPrivatePaymentAmount(result.payment)}
                          </p>
                        </div>
                      ) : null}
                      {result.viewingKey ? (
                        <div>
                          <p className={cn(
                            "mb-1.5 font-sans text-10 font-medium uppercase tracking-widest",
                            isIncognito ? "text-incognito-muted" : "text-muted-light"
                          )}>
                            Viewing key
                          </p>
                          <p className={cn(
                            "break-all font-sans text-11 font-normal",
                            isIncognito ? "text-incognito-text" : "text-[#1a1a1a]"
                          )}>
                            {result.viewingKey}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </form>
            </div>
          </div>

          <div className="mt-8">
            <PromptHistory history={history} onClear={() => setHistory([])} />
          </div>

          {isBooting ? (
            <div className="mt-6 flex items-center gap-2 font-sans text-12 font-normal text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" />
              Booting AgentX402...
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
