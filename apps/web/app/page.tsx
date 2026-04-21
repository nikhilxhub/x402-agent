"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { 
  lamportsToSol, 
  truncateAddress, 
  serializeTransactionToBase64 
} from "./utils";
import { useWallet } from "../providers/WalletProvider";

// --- Configuration ---
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";
const RPC_URL = clusterApiUrl("devnet");

const AVAILABLE_MODELS = [
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI" },
  { id: "groq", name: "Llama 3 (Groq)", provider: "Groq" },
  { id: "gemini-2", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "gemini-2.5-pro", name: "Gemini 1.5 Pro", provider: "Google" },
];

// --- Types ---
type PaymentRequest = {
  receiver: string;
  amountLamports: number;
  memo: string;
  expiresInSec: number;
};

type AIResponse = {
  paidTxSignature: string;
  ai: string;
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

export default function Home() {
  // --- UI State ---
  const { wallet, isConnecting, connectWallet, provider } = useWallet();
  const [isBooting, setIsBooting] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  
  // --- Form State ---
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]!.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  
  // --- Flow State ---
  const [paymentQuote, setPaymentQuote] = useState<PaymentRequest | null>(null);
  const [result, setResult] = useState<AIResponse | null>(null);

  // --- Initialization ---
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
    setStatus("Initiating request...");

    try {
      // Step 1: Initial call to get payment request
      const initRes = await fetch(`${BACKEND_URL}/premium`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, prompt }),
      });

      if (initRes.status !== 402) {
        const data = await initRes.json();
        throw new Error(data.error || "Unexpected response from backend");
      }

      const { paymentRequest } = (await initRes.json()) as { paymentRequest: PaymentRequest };
      setPaymentQuote(paymentRequest);
      setStatus("Awaiting signature...");

      // Step 2: Build and Sign Transaction
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

      // Sign locally via provider
      const signedTx = await provider!.signTransaction(transaction);
      const signedTxBase64 = serializeTransactionToBase64(signedTx);

      setStatus("Verifying payment...");

      // Step 3: Re-submit with payment proof
      const finalRes = await fetch(`${BACKEND_URL}/premium`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x402-signed-tx": signedTxBase64,
        },
        body: JSON.stringify({ model: selectedModel, prompt }),
      });

      const finalData = await finalRes.json();
      if (!finalRes.ok) {
        const detailMsg = finalData.details ? `: ${JSON.stringify(finalData.details)}` : "";
        throw new Error(`${finalData.error || "Payment verification or AI processing failed"}${detailMsg}`);
      }

      setResult(finalData as AIResponse);
      setStatus("Completed");
    } catch (err: any) {
      setError(err.message || "Request failed");
      setStatus("Failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- Render Helpers ---
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
      {/* Dynamic Background Effects */}
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
            Premium pay-per-request AI inference engine, secured by Solana. Minimal, secure, and entirely decentralized.
          </p>
        </header>

        <section className="flex flex-col gap-6">
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-[32px] p-6 sm:p-8 hover:border-white/20 transition-all duration-500 shadow-2xl">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
              <h2 className="text-lg font-semibold tracking-tight">Control Center</h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.05] rounded-full border border-white/5">
                <div className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-[#ef4444]'}`}></div>
                <span className="text-[10px] font-medium text-[#a0a0a0]">Backend {backendOnline ? "Online" : "Offline"}</span>
              </div>
            </div>


            <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#a0a0a0] ml-1">AI Intelligence Layer</label>
                <select 
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#3b82f6] transition-all disabled:opacity-50"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isSubmitting}
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id} className="bg-[#1a1a1a]">{m.name} ({m.provider})</option>
                  ))}
                </select>
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
                      <span className="font-semibold text-[#3b82f6]">{lamportsToSol(paymentQuote.amountLamports)} SOL</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-[#a0a0a0]">Network Service Fee</span>
                      <span className="text-white/40">~0.000005 SOL</span>
                   </div>
                   <div className="pt-2 border-t border-white/5 text-[10px] text-white/30 truncate">
                      Memo: {paymentQuote.memo}
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
                  <span className="tracking-tight">{wallet ? "Dispatch Request" : "Connect Wallet to Dispatch"}</span>
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
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1"/></svg>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <h2 className="text-lg font-semibold tracking-tight">Intelligence Output</h2>
                <div className="px-3 py-1 bg-[#10b981]/10 text-[#10b981] rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#10b981]/20">
                  Verified Settlement
                </div>
              </div>
              
              <div className="text-[#ededed] leading-relaxed text-sm sm:text-base whitespace-pre-wrap selection:bg-[#3b82f6]/40">
                {result.ai}
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1.5">On-Chain Asset Proof</span>
                  <span className="text-[11px] font-mono break-all text-white/50 block leading-tight">{result.paidTxSignature}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1.5">Runtime Model</span>
                  <span className="text-sm font-medium text-white/80">{selectedModel}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className="text-center pb-8 opacity-20 hover:opacity-100 transition-opacity duration-1000">
          <p className="text-[10px] tracking-widest uppercase">Protocol x402 &bull; Agentic AI Proof of Stake</p>
        </footer>
      </div>
    </main>
  );
}
