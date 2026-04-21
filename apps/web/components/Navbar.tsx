"use client";

import React from "react";
import { useWallet } from "../providers/WalletProvider";
import { truncateAddress } from "../app/utils";

export function Navbar() {
  const { wallet, isConnecting, connectWallet } = useWallet();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
      <div className="w-full max-w-5xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-6 py-3 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg">X</span>
          </div>
          <span className="text-white font-bold tracking-tight hidden sm:block">AgentX402</span>
        </div>

        <div className="flex items-center gap-4">
          {!wallet ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="bg-white text-black hover:bg-[#ededed] active:scale-95 transition-all px-5 py-2 rounded-xl font-bold text-sm disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#3b82f6]">Devnet</span>
                <span className="text-xs font-mono text-white/60">{truncateAddress(wallet)}</span>
              </div>
              <div className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-full flex items-center justify-center">
                 <div className="w-2 h-2 bg-[#10b981] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
