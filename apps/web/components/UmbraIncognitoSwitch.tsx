"use client";

import React, { useState } from "react";
import { Shield, ShieldAlert, Zap, Lock, EyeOff } from "lucide-react";

/**
 * UmbraIncognitoSwitch Component
 * 
 * A high-fidelity UI component for toggling "Incognito Mode" using the Umbra Privacy integration.
 * Features custom animations, neon accents, and ambient pulse effects.
 */
const UmbraIncognitoSwitch: React.FC = () => {
  const [isIncognito, setIsIncognito] = useState(false);

  const toggleIncognito = () => {
    setIsIncognito(!isIncognito);
  };

  return (
    <div className="relative flex items-center justify-center p-8 min-h-[300px] bg-[#0B0C10] rounded-3xl overflow-hidden">
      {/* Background Ambient Glow (The Umbra Effect) */}
      <div 
        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out pointer-events-none ${
          isIncognito ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#9945FF]/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#14F195]/5 blur-[80px] rounded-full animate-pulse delay-700" />
      </div>

      {/* Main Card Container */}
      <div className={`relative z-10 w-full max-w-md transition-all duration-500 ease-out 
        ${isIncognito ? "scale-[1.02]" : "scale-100"}`}>
        
        {/* Card Border & Background */}
        <div className="absolute inset-0 bg-[#1A1A24]/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl" />
        
        {/* Content Layer */}
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            
            {/* Header Section */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-500 ${
                    isIncognito ? "bg-[#14F195]/20" : "bg-zinc-800"
                  }`}>
                    {isIncognito ? (
                      <Lock className="w-3.5 h-3.5 text-[#14F195]" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5 text-[#A0AAB2]" />
                    )}
                  </div>
                  <h3 className="text-[#F8F8F8] font-bold text-sm tracking-tight uppercase">
                    Agent Status: Secured by Umbra
                  </h3>
                </div>
                <p className="text-[#A0AAB2] text-xs font-medium leading-relaxed max-w-[240px]">
                  Activate Incognito mode to encrypt your session and obscure on-chain activity.
                </p>
              </div>

              {/* Advanced Toggle Switch */}
              <div className="relative flex flex-col items-center gap-3">
                <button
                  onClick={toggleIncognito}
                  className={`group relative w-16 h-8 rounded-full p-1 transition-all duration-500 ease-in-out cursor-pointer focus:outline-none 
                    ${isIncognito ? "bg-[#1A1A24] border-[#14F195]/50 shadow-[0_0_20px_rgba(20,241,149,0.1)]" : "bg-[#27272A] border-zinc-700"} 
                    border`}
                  aria-pressed={isIncognito}
                >
                  {/* Internal Track Detail */}
                  <div className="absolute inset-2 rounded-full bg-black/20" />
                  
                  {/* The Handle */}
                  <div
                    className={`relative w-6 h-6 rounded-full transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) flex items-center justify-center
                      ${isIncognito 
                        ? "translate-x-8 bg-[#14F195] shadow-[0_0_15px_#14F195]" 
                        : "translate-x-0 bg-[#A0AAB2] shadow-inner"
                      }`}
                  >
                    {isIncognito ? (
                      <Zap className="w-3 h-3 text-[#0B0C10] animate-pulse" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-[#1A1A24]" />
                    )}
                  </div>
                </button>
                
                {/* Active Indicator Label */}
                <div className={`h-4 transition-all duration-500 ${isIncognito ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F8F8F8] drop-shadow-[0_0_10px_rgba(20,241,149,0.8)]">
                    Incognito Active
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Separation / Progress Bar Deco */}
            <div className="relative h-[2px] w-full bg-zinc-800/50 rounded-full overflow-hidden">
              <div 
                className={`absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#14F195] to-transparent transition-all duration-1000 ease-in-out ${
                  isIncognito ? "w-full opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-full"
                }`}
              />
            </div>

            {/* Feature Badges */}
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isIncognito ? "bg-[#14F195] animate-ping" : "bg-zinc-700"}`} />
                <span className="text-[10px] text-[#A0AAB2] uppercase tracking-wider font-bold">Privacy Layer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isIncognito ? "bg-[#9945FF]" : "bg-zinc-700"}`} />
                <span className="text-[10px] text-[#A0AAB2] uppercase tracking-wider font-bold">ZK-Proofs</span>
              </div>
            </div>

          </div>
        </div>

        {/* Scanline Effect (Only visible on active) */}
        <div className={`absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-700 overflow-hidden ${isIncognito ? "opacity-10" : "opacity-0"}`}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,4px_100%]" />
        </div>
      </div>
    </div>
  );
};

export default UmbraIncognitoSwitch;

