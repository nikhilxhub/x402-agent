"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { lamportsToSol, serializeTransactionToBase64 } from "./utils";
import { useWallet } from "../providers/WalletProvider";
import { createUmbraPrivatePayment } from "./umbra";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";
const RPC_URL = clusterApiUrl("devnet");

const AVAILABLE_MODELS = [
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI", priceSol: "0.001 SOL", priceUsdc: "1.00 USDC" },
  { id: "groq", name: "Llama 3 (Groq)", provider: "Groq", priceSol: "0.0005 SOL", priceUsdc: "0.50 USDC" },
  { id: "gemini-2", name: "Gemini 2.0 Flash", provider: "Google", priceSol: "0.0005 SOL", priceUsdc: "0.50 USDC" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", priceSol: "0.002 SOL", priceUsdc: "2.00 USDC" },
] as const;

type PaymentMethod = "standard" | "umbra";

type PaymentRequest = {
  receiver: string;
  amountLamports: number;
  memo: string;
  expiresInSec: number;
  paymentMethod: PaymentMethod;
  currency: "SOL" | "USDC";
  quoteId: string | null;
  umbra: {
    mint: string;
    network: "mainnet" | "devnet" | "localnet";
    indexerApiEndpoint: string;
    treeIndex: number;
  } | null;
};

type AIResponse = {
  paidTxSignature: string;
  ai: string;
  payment?: {
    method: PaymentMethod;
    currency: "SOL" | "USDC";
    amountLamports?: number;
    amountAtomic?: number;
    receiver?: string;
    explorerUrl?: string;
    destinationAddress?: string;
    leafIndex?: string;
    timestamp?: string;
  };
  viewingKey?: string;
};

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

function formatQuoteAmount(quote: PaymentRequest) {
  if (quote.currency === "USDC") {
    return `${(quote.amountLamports / 1_000_000).toFixed(6)} USDC`;
  }

  return `${lamportsToSol(quote.amountLamports)} SOL`;
}

export default function Home() {
  const { wallet, connectWallet, provider } = useWallet();
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

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        if (res.ok) setBackendOnline(true);
      } catch (err) {
        console.error("Backend health check failed", err);
        setBackendOnline(false);
      } finally {
        setIsBooting(false);
      }
    }
    checkHealth();
  }, []);

  async function handleStandardPayment(paymentRequest: PaymentRequest) {
    if (!wallet || !provider) {
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

    const signedTx = await provider.signTransaction(transaction);
    const signedTxBase64 = serializeTransactionToBase64(signedTx);

    const finalRes = await fetch(`${BACKEND_URL}/premium`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x402-signed-tx": signedTxBase64,
      },
      body: JSON.stringify({ model: selectedModel, prompt, paymentMethod: "standard" }),
    });

    return finalRes;
  }

  async function handleUmbraPayment(paymentRequest: PaymentRequest) {
    const privatePayment = await createUmbraPrivatePayment({
      paymentRequest,
      rpcUrl: RPC_URL,
    });

    const finalRes = await fetch(`${BACKEND_URL}/premium`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x402-quote-id": privatePayment.quoteId,
      },
      body: JSON.stringify({ model: selectedModel, prompt, paymentMethod: "umbra" }),
    });

    const finalData = await finalRes.json();
    return {
      response: finalRes,
      data: {
        ...finalData,
        viewingKey: privatePayment.viewingKey,
      } as AIResponse,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!wallet) {
      await connectWallet();
      return;
    }
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    setError("");
    setResult(null);
    setPaymentQuote(null);
    setStatus("Requesting payment quote...");

    try {
      const initRes = await fetch(`${BACKEND_URL}/premium`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, prompt, paymentMethod }),
      });

      if (initRes.status !== 402) {
        const data = await initRes.json();
        throw new Error(data.error || "Unexpected response from backend");
      }

      const { paymentRequest } = (await initRes.json()) as { paymentRequest: PaymentRequest };
      setPaymentQuote(paymentRequest);

      if (paymentMethod === "umbra") {
        setStatus("Creating private Umbra payment...");
        const { response, data } = await handleUmbraPayment(paymentRequest);
        if (!response.ok) {
          const detailMsg = data?.payment ? "" : data ? `: ${JSON.stringify(data)}` : "";
          throw new Error(`Private payment verification or AI processing failed${detailMsg}`);
        }

        setResult(data);
        setStatus("Completed");
        return;
      }

      setStatus("Awaiting signature...");
      const finalRes = await handleStandardPayment(paymentRequest);
      const finalData = (await finalRes.json()) as AIResponse;
      if (!finalRes.ok) {
        const detailMsg = (finalData as any).details
          ? `: ${JSON.stringify((finalData as any).details)}`
          : "";
        throw new Error(
          `${(finalData as any).error || "Payment verification or AI processing failed"}${detailMsg}`
        );
      }

      setResult(finalData);
      setStatus("Completed");
    } catch (err: any) {
      setError(err.message || "Request failed");
      setStatus("Failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isBooting) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-[#a0a0a0]">
        <div className="w-10 h-10 border-3 border-white/10 border-t-[#3b82f6] rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse">Booting AgentX402...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] selection:bg-[#3b82f6]/30 px-4 py-12 md:py-20 flex justify-center overflow-x-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full h-[70%] bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent_70%)]"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-[radial-gradient(circle_at_0%_100%,rgba(59,130,246,0.05),transparent_50%)]"></div>
      </div>

      <div className="w-full max-width-[800px] max-w-2xl flex flex-col gap-12 z-10 animate-in fade-in slide-in-from-bottom-3 duration-1000">
        <header className="text-center">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#3b82f6] mb-3">AI Payment Protocol</p>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 bg-gradient-to-b from-white to-[#a5a5a5] bg-clip-text text-transparent">
            AgentX402
          </h1>
          <p className="text-[#a0a0a0] text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Pay per prompt with standard Solana transfers or experimental Umbra private payments.
          </p>
        </header>

        <section className="flex flex-col gap-6">
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-[32px] p-6 sm:p-8 hover:border-white/20 transition-all duration-500 shadow-2xl">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
              <h2 className="text-lg font-semibold tracking-tight">Control Center</h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.05] rounded-full border border-white/5">
                <div className={`w-2 h-2 rounded-full ${backendOnline ? "bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-[#ef4444]"}`}></div>
                <span className="text-[10px] font-medium text-[#a0a0a0]">Backend {backendOnline ? "Online" : "Offline"}</span>
              </div>
            </div>

            <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#a0a0a0] ml-1">Payment Rail</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${paymentMethod === "standard" ? "border-[#3b82f6] bg-[#3b82f6]/10" : "border-white/[0.08] bg-white/[0.03]"}`}
                    onClick={() => setPaymentMethod("standard")}
                    disabled={isSubmitting}
                  >
                    <span className="block text-sm font-semibold">Standard</span>
                    <span className="block text-[11px] text-white/40 mt-1">Native SOL transfer, fast verification.</span>
                  </button>
                  <button
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${paymentMethod === "umbra" ? "border-[#10b981] bg-[#10b981]/10" : "border-white/[0.08] bg-white/[0.03]"}`}
                    onClick={() => setPaymentMethod("umbra")}
                    disabled={isSubmitting}
                  >
                    <span className="block text-sm font-semibold">Private</span>
                    <span className="block text-[11px] text-white/40 mt-1">Umbra receiver-claimable UTXO with viewing key disclosure.</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#a0a0a0] ml-1">AI Intelligence Layer</label>
                <div className="grid grid-cols-1 gap-2">
                  {AVAILABLE_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedModel(m.id)}
                      disabled={isSubmitting}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-all ${selectedModel === m.id ? "border-[#3b82f6] bg-[#3b82f6]/10" : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"}`}
                    >
                      <div>
                        <span className="block text-sm font-semibold">{m.name}</span>
                        <span className="block text-[11px] text-white/40 mt-0.5">{m.provider}</span>
                      </div>
                      <span className="text-[11px] font-mono text-white/50 shrink-0 ml-3">
                        {paymentMethod === "umbra" ? m.priceUsdc : m.priceSol}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#a0a0a0] ml-1">Context / Prompt</label>
                <textarea
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-4 text-sm min-h-[140px] focus:outline-none focus:border-[#3b82f6] transition-all disabled:opacity-50 placeholder:text-white/20"
                  placeholder="Input your challenge for the model..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {paymentQuote && (
                <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-2xl p-5 space-y-3 animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#a0a0a0]">Inference Fee</span>
                    <span className="font-semibold text-[#3b82f6]">{formatQuoteAmount(paymentQuote)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#a0a0a0]">Payment Rail</span>
                    <span className="text-white/70">{paymentQuote.paymentMethod === "umbra" ? "Umbra private mixer" : "Native Solana transfer"}</span>
                  </div>
                  <div className="pt-2 border-t border-white/5 text-[10px] text-white/30 break-all">
                    Quote ID: {paymentQuote.quoteId || "standard-flow"}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden"
                disabled={isSubmitting || !backendOnline || !prompt.trim()}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span className="text-sm tracking-tight">{status}</span>
                  </>
                ) : (
                  <span className="tracking-tight">
                    {wallet
                      ? paymentMethod === "umbra"
                        ? "Dispatch Private Request"
                        : "Dispatch Request"
                      : "Connect Wallet to Dispatch"}
                  </span>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-6 bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-xs p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <span className="font-bold shrink-0 mt-0.5">Error:</span>
                <span>{error}</span>
              </div>
            )}
          </div>

          {result && (
            <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/[0.08] rounded-[32px] p-6 sm:p-8 animate-in slide-in-from-bottom-8 duration-700 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" />
                </svg>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <h2 className="text-lg font-semibold tracking-tight">Intelligence Output</h2>
                <div className="px-3 py-1 bg-[#10b981]/10 text-[#10b981] rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#10b981]/20">
                  {result.payment?.method === "umbra" ? "Verified Private Payment" : "Verified Settlement"}
                </div>
              </div>

              <div className="text-[#ededed] leading-relaxed text-sm sm:text-base whitespace-pre-wrap selection:bg-[#3b82f6]/40">
                {result.ai}
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1.5">Payment Proof</span>
                  <span className="text-[11px] font-mono break-all text-white/50 block leading-tight">{result.paidTxSignature}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1.5">Runtime Model</span>
                  <span className="text-sm font-medium text-white/80">{selectedModel}</span>
                </div>
                {result.payment?.method === "umbra" && (
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1.5">Private Payment Amount</span>
                    <span className="text-sm font-medium text-white/80">
                      {result.payment.amountAtomic ? (result.payment.amountAtomic / 1_000_000).toFixed(6) : "0.000000"} USDC
                    </span>
                  </div>
                )}
                {result.viewingKey && (
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1.5">Viewing Key</span>
                    <span className="text-[11px] font-mono break-all text-white/50 block leading-tight">{result.viewingKey}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <footer className="text-center pb-8 opacity-20 hover:opacity-100 transition-opacity duration-1000">
          <p className="text-[10px] tracking-widest uppercase">Protocol x402 • Agentic AI Proof of Stake</p>
        </footer>
      </div>
    </main>
  );
}
