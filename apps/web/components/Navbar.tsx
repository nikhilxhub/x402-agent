"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useWallet } from "../providers/WalletProvider";
import { useUmbra } from "../providers/UmbraProvider";
import { truncateAddress } from "../app/utils";

export function Navbar() {
  const { wallet, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const { isIncognito, toggleIncognito } = useUmbra();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleToggle = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      toggleIncognito();
      setIsTransitioning(false);
    }, 800);
  };

  return (
    <nav className="fixed top-6 left-0 right-0 z-[100] flex justify-center px-4">
      {/* Transition Overlay - Shutter Effect */}
      <div className={`fixed inset-0 z-[110] pointer-events-none transition-all duration-700 ${isTransitioning ? "opacity-100" : "opacity-0 invisible"}`}>
        <div className={`absolute top-0 left-0 w-full h-1/2 bg-black transition-transform duration-500 ease-in-out ${isTransitioning ? "translate-y-0" : "-translate-y-full"}`}></div>
        <div className={`absolute bottom-0 left-0 w-full h-1/2 bg-black transition-transform duration-500 ease-in-out ${isTransitioning ? "translate-y-0" : "-translate-y-full"}`}></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`w-24 h-24 relative transition-all duration-500 ${isTransitioning ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>
             <Image src="/image.png" alt="AgentX402" fill className="object-contain" />
          </div>
          <div className={`mt-4 h-px bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,1)] transition-all duration-700 ${isTransitioning ? "w-48 opacity-100" : "w-0 opacity-0"}`}></div>
          <span className={`mt-2 font-serif italic text-blue-400 tracking-widest transition-opacity duration-700 ${isTransitioning ? "opacity-100" : "opacity-0"}`}>
            {isIncognito ? "EXITING UMBRA" : "ENTERING UMBRA"}
          </span>
        </div>
      </div>

      <div className={`w-full max-w-6xl h-14 bg-black/40 backdrop-blur-2xl border transition-all duration-500 rounded-full px-6 flex justify-between items-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${isIncognito ? "border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "border-white/5"}`}>
        <div className="flex items-center gap-3">
          {isIncognito && (
            <div className="relative group">
              <div className="absolute -inset-1 rounded-lg blur transition duration-1000 bg-blue-600 opacity-40 group-hover:opacity-70"></div>
             
            </div>
          )}
          <div className="flex flex-col">
            <span className={`font-serif text-xl leading-tight tracking-tight transition-colors ${isIncognito ? "text-blue-400" : "text-white"}`}>
              AgentX402
            </span>
            
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-300 border ${isIncognito ? "bg-blue-500/10 border-blue-500/50" : "bg-white/5 border-white/5 hover:bg-white/10"}`}
          >
            <div className={`w-2 h-2 rounded-full transition-all duration-500 ${isIncognito ? "bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-white/20"}`}></div>
            <span className={`text-[10px] font-poppins font-bold uppercase tracking-wider ${isIncognito ? "text-blue-400" : "text-white/40"}`}>
              {isIncognito ? "Private" : "Incognito"}
            </span>
          </button>

          <div className="h-4 w-px bg-white/10 hidden md:block"></div>

          {!wallet ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="relative group h-9 px-6 rounded-full overflow-hidden transition-all duration-300"
            >
              <div className={`absolute inset-0 transition-colors ${isIncognito ? "bg-blue-500 group-hover:bg-blue-400" : "bg-white group-hover:bg-blue-50"}`}></div>
              <span className={`relative font-poppins font-bold text-xs uppercase tracking-wider ${isIncognito ? "text-white" : "text-black"}`}>
                {isConnecting ? "Establishing..." : "Connect"}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className={`text-[9px] font-poppins font-bold uppercase tracking-widest opacity-80 ${isIncognito ? "text-blue-300" : "text-blue-400"}`}>Connected</span>
                <span className="text-[11px] font-poppins font-medium text-white/60 tracking-tight">{truncateAddress(wallet)}</span>
              </div>
              <button 
                onClick={disconnectWallet}
                className="group flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/5 transition-all duration-300"
                title="Disconnect Wallet"
              >
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)] group-hover:bg-red-500 group-hover:shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all"></div>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
