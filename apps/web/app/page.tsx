"use client";

import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import styles from "./page.module.css";

type HealthResponse = {
  status: string;
  x402Enabled: boolean;
  paymentToken: string;
  requiredAmount: number;
  recipientWallet: string | null;
  magicblockEnabled: boolean;
  network: string;
  uptime: number;
};

type ModelResponse = {
  id: string;
  name: string;
  provider: string;
  source: "platform" | "user-provided";
  costPerK: {
    input: number;
    output: number;
  };
};

type ChatResponse = {
  response: string;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  receipt: {
    requestId: string;
    paymentSignature: string;
    paymentAmount: number;
    paymentStatus: "verified";
    settlementSignature: string;
    settlementMethod: string;
    apiKeyOwner: string;
    apiKeyEarnings: number;
    platformFee: number;
    timestamp: string;
  };
};

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

function getRpcUrl(network: string): string {
  return network === "mainnet" ? clusterApiUrl("mainnet-beta") : clusterApiUrl("devnet");
}

function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

function encodeSignatureForHeader(signature: string): string {
  return btoa(signature);
}

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [models, setModels] = useState<ModelResponse[]>([]);
  const [wallet, setWallet] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("auto");
  const [isBooting, setIsBooting] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("Loading backend config...");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChatResponse | null>(null);

  const provider = typeof window !== "undefined" ? window.solana : undefined;

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [healthRes, modelsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/health`),
          fetch(`${BACKEND_URL}/api/models`),
        ]);

        if (!healthRes.ok) {
          throw new Error("Failed to load backend health");
        }

        if (!modelsRes.ok) {
          throw new Error("Failed to load available models");
        }

        const nextHealth = (await healthRes.json()) as HealthResponse;
        const nextModels = (await modelsRes.json()) as ModelResponse[];

        if (cancelled) return;

        startTransition(() => {
          setHealth(nextHealth);
          setModels(nextModels);
          setStatus("Ready");
          setError("");
          setIsBooting(false);
        });

        if (provider?.publicKey) {
          setWallet(provider.publicKey.toBase58());
        }
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        setStatus("Backend unavailable");
        setIsBooting(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [provider]);

  const canSubmit =
    !isBooting &&
    !isSubmitting &&
    !!health?.recipientWallet &&
    !!prompt.trim() &&
    !!wallet;

  const selectedModelLabel = useMemo(() => {
    if (selectedModel === "auto") return "Auto routing";
    return models.find((model) => model.id === selectedModel)?.name ?? selectedModel;
  }, [models, selectedModel]);

  async function connectWallet() {
    if (!provider?.isPhantom) {
      setError("No injected Solana wallet found. Open this page in Phantom or another supported wallet browser.");
      return;
    }

    setIsConnecting(true);
    setError("");

    try {
      const response = await provider.connect();
      setWallet(response.publicKey.toBase58());
      setStatus("Wallet connected");
    } catch (err) {
      setError((err as Error).message || "Wallet connection failed");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!provider) {
      setError("Wallet provider not found");
      return;
    }

    if (!health?.recipientWallet) {
      setError("Backend did not expose a recipient wallet");
      return;
    }

    if (!wallet) {
      await connectWallet();
      return;
    }

    setIsSubmitting(true);
    setError("");
    setStatus("Preparing payment...");
    setResult(null);

    try {
      const connection = new Connection(getRpcUrl(health.network), "confirmed");
      const fromPubkey = provider.publicKey ?? new PublicKey(wallet);
      const toPubkey = new PublicKey(health.recipientWallet);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

      const transaction = new Transaction({
        feePayer: fromPubkey,
        recentBlockhash: blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: health.requiredAmount,
        })
      );

      setStatus("Waiting for wallet signature...");
      const { signature } = await provider.signAndSendTransaction(transaction);

      setStatus("Confirming payment...");
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error("Payment transaction failed to confirm");
      }

      setStatus("Calling backend...");
      const payload =
        selectedModel === "auto"
          ? {
              prompt: prompt.trim(),
              consumer_wallet: wallet,
            }
          : {
              prompt: prompt.trim(),
              model: selectedModel,
              consumer_wallet: wallet,
            };

      const chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-payment": encodeSignatureForHeader(signature),
        },
        body: JSON.stringify(payload),
      });

      const data = (await chatRes.json()) as ChatResponse | { error?: string; details?: string };

      if (!chatRes.ok) {
        const message =
          "error" in data && data.error
            ? `${data.error}${data.details ? `: ${data.details}` : ""}`
            : "Chat request failed";
        throw new Error(message);
      }

      setResult(data as ChatResponse);
      setStatus("Completed");
    } catch (err) {
      setError((err as Error).message || "Request failed");
      setStatus("Failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.hero}>
          <p className={styles.eyebrow}>AgentX402 Dapp</p>
          <h1>Pay with SOL, send a prompt, get an AI response.</h1>
          <p className={styles.lead}>
            Minimal frontend for the existing x402 backend. The client reads backend
            config, asks the connected wallet to pay, then calls <code>/api/chat</code>.
          </p>
        </div>

        <section className={styles.grid}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Request</h2>
              <button
                type="button"
                className={styles.connectButton}
                onClick={() => {
                  void connectWallet();
                }}
                disabled={isConnecting}
              >
                {wallet ? "Wallet connected" : isConnecting ? "Connecting..." : "Connect wallet"}
              </button>
            </div>

            <div className={styles.metaRow}>
              <span>Status: {status}</span>
              <span>Network: {health?.network ?? "--"}</span>
            </div>
            <div className={styles.metaRow}>
              <span>Wallet: {wallet || "Not connected"}</span>
              <span>
                Price: {health ? `${lamportsToSol(health.requiredAmount)} SOL` : "--"}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span>Recipient: {health?.recipientWallet ?? "--"}</span>
              <span>Selected: {selectedModelLabel}</span>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span>Model</span>
                <select
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                >
                  <option value="auto">Auto</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider}, {model.source})
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Prompt</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ask the backend something useful..."
                  rows={8}
                />
              </label>

              <button type="submit" className={styles.submitButton} disabled={!canSubmit}>
                {isSubmitting ? "Processing..." : wallet ? "Pay and send" : "Connect wallet first"}
              </button>
            </form>

            {error ? <p className={styles.error}>{error}</p> : null}
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Response</h2>
            </div>

            {result ? (
              <div className={styles.output}>
                <pre className={styles.responseBlock}>
                  <code>{result.response}</code>
                </pre>

                <div className={styles.receipt}>
                  <p>Model: {result.model}</p>
                  <p>Prompt tokens: {result.tokens.prompt}</p>
                  <p>Completion tokens: {result.tokens.completion}</p>
                  <p>Total tokens: {result.tokens.total}</p>
                  <p>Payment signature: {result.receipt.paymentSignature}</p>
                  <p>Settlement: {result.receipt.settlementMethod}</p>
                  <p>Request ID: {result.receipt.requestId}</p>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p>The backend response and receipt will appear here.</p>
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
