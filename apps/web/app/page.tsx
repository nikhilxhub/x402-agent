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
import UmbraIncognitoSwitch from "../components/UmbraIncognitoSwitch";
import {
  cn,
  lamportsToSol,
  serializeTransactionToBase64,
  truncateAddress,
} from "./utils";
import { useWallet } from "../providers/WalletProvider";
import { createUmbraPrivatePayment } from "./umbra";
import { Activity, Shield, Terminal as TerminalIcon, Zap } from "lucide-react";

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
      <div className="glow-mesh" />
      <Navbar
        isIncognito={isIncognito}
        onToggleIncognito={() =>
          setPaymentMethod((current) => (current === "umbra" ? "standard" : "umbra"))
        }
      />

      <main className="min-h-screen pt-24 pb-12">
        <div className="mx-auto max-w-5xl px-6 lg:grid lg:grid-cols-12 lg:gap-12">
          
          {/* Left Column: UI Controls & Info */}
          <div className="lg:col-span-5 space-y-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-neon-cyan/20 to-electric-purple/20 blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <UmbraIncognitoSwitch 
                isIncognito={isIncognito} 
                onToggle={() => setPaymentMethod(isIncognito ? "standard" : "umbra")} 
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-dark-grey/40 backdrop-blur-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                    <Activity className="w-5 h-5 text-neon-cyan" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-silver">System Status</p>
                    <p className="text-sm font-bold text-ghost-white">
                      {backendOnline ? "Network Operational" : "System Offline"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", backendOnline ? "bg-neon-cyan" : "bg-red-500")}></span>
                    <span className={cn("relative inline-flex rounded-full h-2 w-2", backendOnline ? "bg-neon-cyan" : "bg-red-500")}></span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-silver">Devnet-V1</span>
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-silver">Active Encryption</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <p className="text-[9px] font-bold text-muted-silver uppercase mb-1">Protocol</p>
                    <p className="text-xs font-mono text-ghost-white">Umbra-ZK-4.0</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <p className="text-[9px] font-bold text-muted-silver uppercase mb-1">Session</p>
                    <p className="text-xs font-mono text-ghost-white truncate">{createTraceId().split("-")[0]}</p>
                  </div>
                </div>
              </div>
            </div>

            <WalletBanner isIncognito={isIncognito} />
          </div>

          {/* Right Column: Main Terminal Flow */}
          <div className="lg:col-span-7 mt-12 lg:mt-0">
            <div
              className={cn(
                "relative rounded-3xl border border-white/10 bg-dark-grey/60 backdrop-blur-2xl p-8 transition-all duration-700",
                isIncognito ? "shadow-[0_0_50px_rgba(153,69,255,0.1)] border-electric-purple/20" : "shadow-2xl"
              )}
            >
              {/* Terminal Header Deco */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-neon-cyan/20 to-transparent rounded-t-3xl" />
              
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TerminalIcon className="w-5 h-5 text-neon-cyan" />
                    <h2 className="text-lg font-bold text-ghost-white tracking-tight uppercase">Agent Terminal</h2>
                  </div>
                  {wallet && (
                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-neon-cyan" />
                      <span className="text-[10px] font-mono text-muted-silver">{truncateAddress(wallet)}</span>
                    </div>
                  )}
                </div>

                <StepIndicator currentStep={currentStep} isIncognito={isIncognito} />

                <div className="h-px w-full bg-white/5" />

                <form className="space-y-8" onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-silver">Select Neural Model</label>
                      <span className="text-[10px] font-bold text-neon-cyan uppercase">{selectedModelMeta.provider}</span>
                    </div>
                    <ModelChips
                      models={AVAILABLE_MODELS.map((model) => ({
                        id: model.id,
                        label: model.name,
                      }))}
                      selectedModel={selectedModel}
                      onSelect={setSelectedModel}
                      isIncognito={isIncognito}
                    />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-white/5">
                      <Zap className="w-3.5 h-3.5 text-neon-cyan" />
                      <p className="text-[11px] font-medium text-muted-silver">
                        Execution Cost: <span className="text-ghost-white">{isIncognito ? selectedModelMeta.priceUsdc : selectedModelMeta.priceSol}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-silver">Task Parameters (Prompt)</label>
                    <div className="relative group">
                      <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder="Define agent task sequence..."
                        rows={5}
                        className={cn(
                          "w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-5 py-4",
                          "font-mono text-13 text-ghost-white placeholder:text-muted-silver/30",
                          "transition-all duration-300 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20",
                          isIncognito && "focus:border-electric-purple/50 focus:ring-electric-purple/20"
                        )}
                        disabled={isSubmitting}
                      />
                      <div className="absolute bottom-4 right-4 flex items-center gap-2">
                        <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] text-muted-silver">CTRL</kbd>
                        <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] text-muted-silver">ENTER</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-6 pt-4">
                    <div className="hidden sm:block">
                      {isIncognito ? (
                        <div className="flex items-center gap-2 text-electric-purple">
                          <Shield className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Umbra Privacy Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-silver/50">
                          <Activity className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Standard Mode</span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isSubmitting || !backendOnline || !prompt.trim()}
                      className={cn(
                        "group relative min-h-12 flex-1 overflow-hidden rounded-xl font-sans text-13 font-bold uppercase tracking-widest transition-all active:scale-[0.98]",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                        isIncognito
                          ? "bg-electric-purple text-white shadow-[0_0_20px_rgba(153,69,255,0.4)] hover:shadow-[0_0_30px_rgba(153,69,255,0.6)]"
                          : "bg-neon-cyan text-obsidian shadow-[0_0_20px_rgba(20,241,149,0.4)] hover:shadow-[0_0_30px_rgba(20,241,149,0.6)]"
                      )}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {wallet ? (isSubmitting ? status : "Initialize Sequence →") : "Connect Authorized Wallet"}
                      </span>
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 bg-white/10 transition-transform duration-500" />
                    </button>
                  </div>

                  {paymentQuote && (
                    <div className="animate-fade-in space-y-4">
                      <div className="h-px w-full bg-white/5" />
                      <QuoteBlock
                        price={formatQuoteValue(paymentQuote)}
                        modelLabel={selectedModelMeta.name}
                        currency={paymentQuote.paymentMethod === "umbra"
                          ? (paymentQuote.umbra?.symbol ?? paymentQuote.currency)
                          : "SOL"}
                        isIncognito={isIncognito}
                        isPhantomWallet={isPhantomWallet}
                      />
                      <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-white/5 border border-white/5">
                        <span className="text-[9px] font-bold text-muted-silver uppercase tracking-widest">Encryption Hash</span>
                        <span className="text-[9px] font-mono text-ghost-white truncate max-w-[200px]">{paymentQuote.quoteId || "SHA-256-GEN"}</span>
                      </div>
                    </div>
                  )}

                  {quoteStatus && (
                    <div className="animate-fade-in space-y-4">
                      <div className="h-px w-full bg-white/5" />
                      <StatusBar status={quoteStatus} isIncognito={isIncognito} />
                      {error && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                          <p className="text-xs font-medium text-red-400">{error}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {result && (
                    <div className="animate-fade-in space-y-6">
                      <div className="h-px w-full bg-white/5" />
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-neon-cyan" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-ghost-white">Agent Output</h3>
                      </div>
                      <ResponseArea
                        text={displayedResponse}
                        isStreaming={isResponseStreaming}
                        isIncognito={isIncognito}
                      />
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 p-4 rounded-2xl bg-white/5 border border-white/5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-silver">Verified Signature</p>
                          <p className="font-mono text-[10px] text-ghost-white break-all leading-relaxed">
                            {result.payment?.verifiedSignature || result.paidTxSignature}
                          </p>
                        </div>
                        <div className="space-y-1.5 p-4 rounded-2xl bg-white/5 border border-white/5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-silver">Execution Result</p>
                          <p className="text-xs font-bold text-neon-cyan uppercase">Success - Verified</p>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>

            <div className="mt-8">
              <PromptHistory history={history} onClear={() => setHistory([])} />
            </div>

            {isBooting && (
              <div className="mt-12 flex flex-col items-center gap-4 py-8 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-md">
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 rounded-full border-2 border-neon-cyan/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-neon-cyan animate-spin" />
                </div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-neon-cyan animate-pulse">
                  Synchronizing Neural Links...
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="py-12 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
             <span className="font-serif-italic text-20 text-ghost-white">AgentX402</span>
             <p className="text-[10px] font-bold uppercase tracking-widest text-muted-silver">Privacy by Default · Security by Design</p>
          </div>
          <div className="flex gap-8">
             <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-silver hover:text-neon-cyan transition-colors">Privacy Policy</a>
             <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-silver hover:text-neon-cyan transition-colors">Terms of Service</a>
             <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-silver hover:text-neon-cyan transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </>
  );
}

