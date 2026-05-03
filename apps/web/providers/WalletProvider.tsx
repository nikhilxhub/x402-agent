"use client";

import React, { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
  LedgerWalletAdapter,
  CoinbaseWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

// Default styles that can be overridden by your app
import "@solana/wallet-adapter-react-ui/styles.css";

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Devnet;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TrustWalletAdapter(),
      new LedgerWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

// We redefine useWallet to match our previous interface for compatibility
// but now it uses the real Solana Wallet Adapter under the hood
export function useWallet() {
  const {
    publicKey,
    wallet,
    disconnect,
    select,
    connecting,
    wallets,
    connected,
    signTransaction,
  } = useSolanaWallet();
  const { setVisible } = useWalletModal();

  const connectWallet = async () => {
    setVisible(true);
  };

  return {
    wallet: publicKey ? publicKey.toBase58() : "",
    isConnecting: connecting,
    connectWallet,
    disconnectWallet: disconnect,
    provider: wallet?.adapter,
    publicKey,
    wallets,
    select,
    connected,
    setVisible,
    signTransaction,
  };
}
