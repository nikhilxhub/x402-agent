"use client";

import { FormEvent, useEffect, useState, useRef } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import Image from "next/image";
import { lamportsToSol, serializeTransactionToBase64 } from "./utils";
import { useWallet } from "../providers/WalletProvider";
import { useUmbra } from "../providers/UmbraProvider";
import { createUmbraPrivatePayment } from "./umbra";
import ReactMarkdown from "react-markdown";


const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";
const RPC_URL = clusterApiUrl("devnet");

const AVAILABLE_MODELS = [
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI", priceSol: "0.001 SOL", priceUsdc: "1.00 USDC" },
  { id: "groq", name: "Llama 3 (Groq)", provider: "Groq", priceSol: "0.0005 SOL", priceUsdc: "0.50 USDC" },
  { id: "gemini-2", name: "Gemini 2.0 Flash", provider: "Google", priceSol: "0.0005 SOL", priceUsdc: "0.50 USDC" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", priceSol: "0.002 SOL", priceUsdc: "2.00 USDC" },
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

type ChatMessage = {
  id: string;
  prompt: string;
  result: AIResponse;
  timestamp: number;
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

function formatQuoteAmount(quote: PaymentRequest) {
  if (quote.paymentMethod === "umbra") {
    const decimals = quote.umbra?.decimals ?? 6;
    const symbol = quote.umbra?.symbol ?? quote.currency;
    return `${(quote.amountLamports / 10 ** decimals).toFixed(decimals)} ${symbol}`;
  }

  return `${lamportsToSol(quote.amountLamports)} SOL`;
}

function formatPrivatePaymentAmount(payment: NonNullable<AIResponse["payment"]>) {
  const decimals = payment.decimals ?? 6;
  return `${((payment.amountAtomic ?? 0) / 10 ** decimals).toFixed(decimals)} ${payment.currency}`;
}

export default function Home() {
  const { wallet, connectWallet, signTransaction } = useWallet();
  const { paymentMethod, setPaymentMethod } = useUmbra();
  const [isBooting, setIsBooting] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0]!.id);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [paymentQuote, setPaymentQuote] = useState<PaymentRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [greeting, setGreeting] = useState("Good afternoon");
  const [isChatActive, setIsChatActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("x402_chat_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setIsChatActive(true);
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("x402_chat_history", JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

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

  // Set chat active when we have messages
  useEffect(() => {
    if (messages.length > 0) {
      setIsChatActive(true);
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isChatActive && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isChatActive, isSubmitting, error]);

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

  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!wallet) {
      await connectWallet();
      return;
    }
    if (!prompt.trim()) return;

    setIsChatActive(true);
    setIsSubmitting(true);
    setError("");
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

        const newMessage: ChatMessage = {
          id: traceId,
          prompt,
          result: data,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, newMessage]);
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
        const detailMsg = (finalData as any).details
          ? `: ${JSON.stringify((finalData as any).details)}`
          : "";
        throw new Error(
          `${(finalData as any).error || "Payment verification or AI processing failed"}${detailMsg}`
        );
      }

      const newMessage: ChatMessage = {
        id: traceId,
        prompt,
        result: finalData,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMessage]);
      setStatus("Completed");
    } catch (err: any) {
      console.error("[Premium][Frontend] submission.failed", {
        message: err.message || "Request failed",
      });
      setError(err.message || "Request failed");
      setStatus("Failed");
    } finally {
      console.groupEnd();
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

  const selectedModelData = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0]!;

  return (
    <main className={`h-screen bg-[#0a0a0a] text-[#f5f5f5] selection:bg-[#3b82f6]/30 flex flex-col items-center overflow-hidden relative transition-all duration-1000 ${isChatActive ? "pt-24 pb-4" : "justify-center"}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full h-[70%] bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.1),transparent_70%)]"></div>
      </div>

      <div className={`w-full max-w-3xl flex flex-col z-10 transition-all duration-1000 h-full ${isChatActive ? "gap-4" : "gap-10 animate-in fade-in slide-in-from-bottom-4"}`}>
        
        {/* Scrollable Conversation Area */}
        <div 
          ref={scrollRef}
          className={`flex-1 flex flex-col gap-8 transition-all duration-1000 custom-scrollbar ${isChatActive ? "overflow-y-auto px-4 pb-4" : "overflow-visible py-12 md:py-24"}`}
        >
          <div className="flex flex-col items-center text-center gap-6 mb-4">
            <div className="flex items-center gap-4">
              <h1 className={`font-serif text-white/90 tracking-tight transition-all duration-700 ${isChatActive ? "text-2xl opacity-40" : "text-4xl md:text-5xl"}`}>
                {greeting}
              </h1>
            </div>
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-6">
              {/* User Prompt */}
              <div className="flex justify-end px-4">
                <div className="max-w-[80%] bg-white/[0.03] border border-white/[0.05] rounded-[24px] px-6 py-4">
                  <p className="text-sm text-white/70 font-poppins">{msg.prompt}</p>
                </div>
              </div>

              {/* AI Response */}
              <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/[0.08] rounded-[32px] p-8 animate-in slide-in-from-bottom-8 duration-700 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 relative bg-white/5 rounded flex items-center justify-center p-1">
                      <Image src="/image.png" alt="Icon" width={16} height={16} className="object-contain opacity-50" />
                    </div>
                    <h2 className="text-sm font-semibold tracking-tight text-white/60 font-poppins italic">Intelligence Output</h2>
                  </div>
                  <div className="px-3 py-1 bg-[#10b981]/10 text-[#10b981] rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#10b981]/20 font-poppins">
                    {msg.result.payment?.method === "umbra" ? "Verified Private" : "Verified Standard"}
                  </div>
                </div>

                <div className="text-[#ededed] leading-relaxed text-base font-poppins markdown-content selection:bg-[#3b82f6]/40">
                  <ReactMarkdown>{msg.result.ai}</ReactMarkdown>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap gap-6">
                  <div className="flex-1 min-w-[200px]">
                    <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1 font-poppins">Payment Proof</span>
                    <span className="text-[11px] font-mono break-all text-white/30 block leading-tight">{msg.result.payment?.verifiedSignature || msg.result.paidTxSignature}</span>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1 font-poppins">Model Used</span>
                    <span className="text-xs font-medium text-white/60 font-poppins">{selectedModel}</span>
                  </div>
                  {msg.result.viewingKey && (
                    <div className="w-full">
                      <span className="block text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-1 font-poppins">Viewing Key</span>
                      <span className="text-[11px] font-mono break-all text-white/30 block leading-tight">{msg.result.viewingKey}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}


          {error && (
            <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-xs p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <span className="font-bold shrink-0 mt-0.5">Error:</span>
              <span>{error}</span>
            </div>
          )}

          {status !== "Ready" && status !== "Completed" && status !== "Failed" && isSubmitting && (
             <div className="flex items-center justify-center gap-3 text-white/40 font-poppins text-xs animate-pulse py-8">
               <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
               {status}
             </div>
          )}
        </div>

        {/* Bottom Area: Input + Footer */}
        <div className="flex flex-col gap-4 flex-shrink-0 px-4">
          <div className="relative group">
            <div className={`absolute -inset-1 rounded-[32px] blur-xl transition-all duration-1000 opacity-20 ${paymentMethod === "umbra" ? "bg-blue-600/40 opacity-30" : "bg-white/10"}`}></div>
            <div className="relative bg-[#111111] border border-white/5 rounded-[32px] shadow-2xl">
              <textarea
                className={`w-full bg-transparent px-8 pt-8 pb-20 text-lg md:text-xl font-poppins font-light focus:outline-none resize-none placeholder:text-white/10 transition-all duration-500 rounded-[32px] ${isChatActive ? "min-h-[100px] max-h-[200px]" : "min-h-[180px]"}`}
                placeholder="How can AgentX402 help you today?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isSubmitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              
              <div className="absolute bottom-4 left-6 right-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <button
                    type="button"
                    onClick={() => setPaymentMethod(paymentMethod === "standard" ? "umbra" : "standard")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 border ${paymentMethod === "umbra" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${paymentMethod === "umbra" ? "bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-white/20"}`}></div>
                    <span className="text-[10px] font-poppins font-bold uppercase tracking-wider">
                      {paymentMethod === "umbra" ? "Umbra Private" : "Standard"}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Custom Premium Model Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => !isSubmitting && setIsModelSelectorOpen(!isModelSelectorOpen)}
                      className={`group flex items-center gap-2.5 px-4 py-2 rounded-full transition-all duration-300 border backdrop-blur-md ${isModelSelectorOpen ? "bg-white/10 border-white/20 ring-4 ring-white/5" : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"} ${isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span className="text-[11px] font-poppins font-semibold text-white/80 tracking-wide uppercase">
                        {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}
                      </span>
                      <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                        {paymentMethod === "umbra" 
                          ? AVAILABLE_MODELS.find(m => m.id === selectedModel)?.priceUsdc 
                          : AVAILABLE_MODELS.find(m => m.id === selectedModel)?.priceSol}
                      </span>
                      <svg 
                        className={`w-3 h-3 text-white/20 transition-transform duration-500 ${isModelSelectorOpen ? "rotate-180" : ""}`} 
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isModelSelectorOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsModelSelectorOpen(false)}
                        ></div>
                        <div className="absolute bottom-full mb-3 right-0 w-[240px] z-50 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 origin-bottom-right">
                          <div className="bg-[#0f0f0f]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                            <div className="px-3 py-2 mb-1">
                              <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">Select Intelligence</span>
                            </div>
                            {AVAILABLE_MODELS.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setSelectedModel(m.id);
                                  setIsModelSelectorOpen(false);
                                }}
                                className={`w-full flex flex-col gap-0.5 px-4 py-3 rounded-[18px] text-left transition-all duration-200 group/item ${selectedModel === m.id ? "bg-white/10" : "hover:bg-white/5"}`}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-poppins font-medium transition-colors ${selectedModel === m.id ? "text-white" : "text-white/60 group-hover/item:text-white/80"}`}>
                                      {m.name}
                                    </span>
                                    {m.id !== "groq" && (
                                      <span className="px-1.5 py-0.5 bg-white/5 border border-white/5 rounded-md text-[8px] font-bold text-white/20 uppercase tracking-tighter">
                                        Rate Limited
                                      </span>
                                    )}
                                  </div>
                                  {selectedModel === m.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                                  )}
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-[10px] text-white/20 font-poppins tracking-wider">{m.provider}</span>
                                  <span className={`text-[10px] font-mono ${selectedModel === m.id ? "text-white/40" : "text-white/20 group-hover/item:text-white/30"}`}>
                                    {paymentMethod === "umbra" ? m.priceUsdc : m.priceSol}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => handleSubmit()}
                    disabled={isSubmitting || !prompt.trim()}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 ${isSubmitting || !prompt.trim() ? "bg-white/5 text-white/5" : "bg-white text-black hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)]"}`}
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-black/10 border-t-black rounded-full animate-spin"></div>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <footer className={`text-center transition-all duration-1000 ${isChatActive ? "opacity-10 pb-2" : "opacity-20 hover:opacity-100"}`}>
            <p className="text-[10px] font-poppins tracking-[0.3em] uppercase">Protocol x402 • Agentic AI Layer</p>
          </footer>
        </div>
      </div>
    </main>
  );
}
