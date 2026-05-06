"use client";

import React from "react";
import { cn } from "../app/utils";
import { AlertCircle, Info, ShieldAlert } from "lucide-react";

export function WalletBanner({ isIncognito }: { isIncognito: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-5 py-4 transition-all duration-500",
        isIncognito
          ? "border-electric-purple/30 bg-electric-purple/5 text-muted-silver shadow-[0_0_20px_rgba(153,69,255,0.05)]"
          : "border-neon-cyan/20 bg-neon-cyan/5 text-muted-silver"
      )}
    >
      <div className="flex gap-4">
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border",
          isIncognito ? "bg-electric-purple/10 border-electric-purple/20" : "bg-neon-cyan/10 border-neon-cyan/20"
        )}>
          {isIncognito ? (
            <ShieldAlert className="w-5 h-5 text-electric-purple" />
          ) : (
            <Info className="w-5 h-5 text-neon-cyan" />
          )}
        </div>
        
        <div className="space-y-1">
          <p className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            isIncognito ? "text-electric-purple" : "text-neon-cyan"
          )}>
            {isIncognito ? "Privacy Compatibility Notice" : "Wallet Integration"}
          </p>
          <p className="text-[12px] font-medium leading-relaxed">
            {isIncognito ? (
              <>
                Private payments require <span className="text-ghost-white font-bold">Solflare</span> or the <span className="text-ghost-white font-bold">Umbra Wallet</span>. 
                <span className="block mt-1 text-[11px] opacity-70">
                  Phantom does not yet support stealth addresses and will result in a failed transaction.
                </span>
              </>
            ) : (
              <>
                Standard payments are compatible with all major Solana providers including 
                <span className="text-ghost-white font-bold"> Phantom</span>, 
                <span className="text-ghost-white font-bold"> Backpack</span>, and 
                <span className="text-ghost-white font-bold"> Solflare</span>.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

