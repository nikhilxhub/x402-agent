"use client";

import React from "react";
import { cn, truncateAddress } from "../app/utils";
import { useWallet } from "../providers/WalletProvider";
import { Shield, ShieldAlert, Wallet } from "lucide-react";

type NavbarProps = {
  isIncognito: boolean;
  onToggleIncognito: () => void;
};

export function Navbar({ isIncognito, onToggleIncognito }: NavbarProps) {
  const { wallet, isConnecting, connectWallet, disconnectWallet } = useWallet();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 h-14 border-b border-white/5 bg-obsidian/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <span className="font-serif-italic text-24 text-ghost-white select-none tracking-tight">
            Agent<span className="text-neon-cyan">X</span>402
          </span>
          
          <div className="hidden md:flex items-center gap-6">
            <a href="#" className="text-xs font-bold uppercase tracking-widest text-muted-silver hover:text-neon-cyan transition-colors">Terminal</a>
            <a href="#" className="text-xs font-bold uppercase tracking-widest text-muted-silver hover:text-neon-cyan transition-colors">Analytics</a>
            <a href="#" className="text-xs font-bold uppercase tracking-widest text-muted-silver hover:text-neon-cyan transition-colors">Documentation</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!wallet ? (
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className={cn(
                "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2",
                "font-sans text-12 font-bold uppercase tracking-wider text-ghost-white",
                "transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50",
                "disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              <Wallet className="w-3.5 h-3.5" />
              {isConnecting ? "Connecting..." : "Connect wallet"}
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnectWallet}
              className={cn(
                "flex items-center gap-2 rounded-full border border-neon-cyan/20 bg-neon-cyan/5 px-5 py-2",
                "font-sans text-12 font-bold uppercase tracking-wider text-neon-cyan",
                "transition-all duration-300 hover:bg-neon-cyan/10 hover:border-neon-cyan/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50"
              )}
              title="Disconnect wallet"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
              {truncateAddress(wallet)}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleIncognito}
            className={cn(
              "group relative flex items-center gap-2 rounded-full border px-5 py-2",
              "font-sans text-12 font-bold uppercase tracking-wider select-none transition-all duration-500",
              isIncognito
                ? "border-electric-purple/50 bg-electric-purple/10 text-ghost-white shadow-[0_0_20px_rgba(153,69,255,0.2)]"
                : "border-white/10 bg-transparent text-muted-silver hover:bg-white/5 hover:border-white/20"
            )}
          >
            {isIncognito ? (
              <Shield className="w-3.5 h-3.5 text-electric-purple animate-pulse" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-muted-silver" />
            )}
            Incognito
            {isIncognito && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-electric-purple opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-electric-purple"></span>
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

