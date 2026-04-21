"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
};

interface WalletContextType {
  wallet: string;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  provider: PhantomProvider | undefined;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<PhantomProvider | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const solana = (window as any).solana;
      if (solana?.isPhantom) {
        setProvider(solana);
        if (solana.publicKey) {
          setWallet(solana.publicKey.toBase58());
        }
      }
    }
  }, []);

  const connectWallet = async () => {
    if (!provider) {
      alert("Please install Phantom wallet to use this Dapp.");
      return;
    }
    setIsConnecting(true);
    try {
      const resp = await provider.connect();
      setWallet(resp.publicKey.toBase58());
    } catch (err: any) {
      console.error("Failed to connect wallet", err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <WalletContext.Provider value={{ wallet, isConnecting, connectWallet, provider }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
