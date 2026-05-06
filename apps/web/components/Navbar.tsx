"use client";

import React from "react";
import { cn, truncateAddress } from "../app/utils";
import { useWallet } from "../providers/WalletProvider";

type NavbarProps = {
  isIncognito: boolean;
  onToggleIncognito: () => void;
};

export function Navbar({ isIncognito, onToggleIncognito }: NavbarProps) {
  const { wallet, isConnecting, connectWallet, disconnectWallet } = useWallet();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 h-12 border-b border-px border-black/10 bg-white">
      <div className="mx-auto flex h-full max-w-[640px] items-center justify-between px-6 sm:px-4">
        <span className="font-serif-italic text-20 text-[#1a1a1a] select-none">
          AgentX402
        </span>

        <div className="flex items-center gap-2.5">
          {!wallet ? (
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className={cn(
                "min-h-10 rounded-full border-px border-black/20 px-3.5 py-1.5",
                "font-sans text-12 font-medium text-[#1a1a1a]",
                "transition-colors duration-100 hover:bg-surface",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              {isConnecting ? "Connecting..." : "Connect wallet"}
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnectWallet}
              className={cn(
                "min-h-10 rounded-full border-px border-black/20 px-3.5 py-1.5",
                "font-sans text-12 font-medium text-[#1a1a1a]",
                "transition-colors duration-100 hover:bg-surface",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2"
              )}
              title="Disconnect wallet"
            >
              {truncateAddress(wallet)}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleIncognito}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-full border-px px-3.5 py-1.5",
              "font-sans text-12 font-medium select-none",
              "transition-all duration-200 ease-in-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2",
              isIncognito
                ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                : "border-black/20 bg-transparent text-muted hover:bg-surface"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                isIncognito ? "bg-white" : "bg-muted-light"
              )}
            />
            Incognito
          </button>
        </div>
      </div>
    </nav>
  );
}
