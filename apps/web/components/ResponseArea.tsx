"use client";

import React from "react";
import { cn } from "../app/utils";

export function ResponseArea({
  text,
  isStreaming,
  isIncognito,
}: {
  text: string;
  isStreaming: boolean;
  isIncognito: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-black/40 p-6 shadow-inner">
      {/* Dynamic Background Mesh for Incognito */}
      {isIncognito && (
        <div className="absolute inset-0 bg-electric-purple/5 opacity-20 pointer-events-none" />
      )}
      
      <div className="relative">
        <p
          className={cn(
            "mb-4 font-sans text-[10px] font-black uppercase tracking-[0.2em]",
            isIncognito ? "text-electric-purple" : "text-neon-cyan"
          )}
        >
          {isStreaming ? "Synthesizing Response..." : "Neural Output"}
        </p>

        <div
          className={cn(
            "font-mono text-14 leading-relaxed",
            isStreaming && "typewriter-cursor",
            isIncognito ? "text-ghost-white" : "text-ghost-white/90"
          )}
        >
          {text}
        </div>
      </div>
      
      {/* Decorative Scanline */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
    </div>
  );
}

