"use client";

import React from "react";
import { cn } from "../app/utils";
import { Check, Circle } from "lucide-react";

const STEPS = [
  { n: 1 as const, title: "Initialize Sequence", desc: "Select neural model and define parameters" },
  { n: 2 as const, title: "Quote Received", desc: "Encryption cost calculated on-chain" },
  { n: 3 as const, title: "Secure Protocol", desc: "Confirm transaction with authorized signature" },
  { n: 4 as const, title: "Output Synthesis", desc: "ZK-Proof verified and AI response generated" },
];

export function StepIndicator({
  currentStep,
  isIncognito,
}: {
  currentStep: 1 | 2 | 3 | 4;
  isIncognito: boolean;
}) {
  return (
    <div className="space-y-6">
      {STEPS.map((step, idx) => {
        const done = currentStep > step.n;
        const active = currentStep === step.n;
        const isLast = idx === STEPS.length - 1;

        return (
          <div key={step.n} className="relative flex items-start gap-4 group">
            {/* Connector Line */}
            {!isLast && (
              <div 
                className={cn(
                  "absolute left-[11px] top-[24px] w-[2px] h-[calc(100%+8px)] transition-all duration-700",
                  done 
                    ? isIncognito ? "bg-electric-purple/40" : "bg-neon-cyan/40" 
                    : "bg-white/5"
                )} 
              />
            )}

            {/* Node */}
            <div
              className={cn(
                "relative z-10 flex h-[24px] w-[24px] flex-shrink-0 items-center justify-center rounded-full border transition-all duration-500",
                done
                  ? isIncognito 
                    ? "border-electric-purple bg-electric-purple text-obsidian shadow-[0_0_10px_rgba(153,69,255,0.5)]" 
                    : "border-neon-cyan bg-neon-cyan text-obsidian shadow-[0_0_10px_rgba(20,241,149,0.5)]"
                  : active
                    ? isIncognito
                      ? "border-electric-purple bg-electric-purple/20 text-electric-purple shadow-[0_0_15px_rgba(153,69,255,0.3)] animate-pulse"
                      : "border-neon-cyan bg-neon-cyan/20 text-neon-cyan shadow-[0_0_15px_rgba(20,241,149,0.3)] animate-pulse"
                    : "border-white/10 bg-black/40 text-muted-silver"
              )}
            >
              {done ? (
                <Check className="w-3.5 h-3.5 stroke-[3px]" />
              ) : (
                <span className="text-[10px] font-black">{step.n}</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1">
              <p
                className={cn(
                  "font-sans text-[11px] font-black uppercase tracking-[0.15em] transition-colors duration-500",
                  active || done ? "text-ghost-white" : "text-muted-silver/40"
                )}
              >
                {step.title}
              </p>
              {active && (
                <p className="font-sans text-[11px] text-muted-silver leading-relaxed animate-in fade-in slide-in-from-left-2 duration-500">
                  {step.desc}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

