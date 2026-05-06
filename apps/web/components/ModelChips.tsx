"use client";

import React from "react";
import { cn } from "../app/utils";
import { Cpu } from "lucide-react";

type Model = {
  id: string;
  label: string;
};

export function ModelChips({
  models,
  selectedModel,
  onSelect,
  isIncognito,
}: {
  models: Model[];
  selectedModel: string;
  onSelect: (id: string) => void;
  isIncognito: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {models.map((model) => {
        const selected = selectedModel === model.id;

        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onSelect(model.id)}
            className={cn(
              "relative flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all duration-300",
              "font-sans text-12 font-bold uppercase tracking-wider group",
              selected
                ? isIncognito
                  ? "border-electric-purple/50 bg-electric-purple/10 text-ghost-white shadow-[0_0_15px_rgba(153,69,255,0.1)]"
                  : "border-neon-cyan/50 bg-neon-cyan/10 text-ghost-white shadow-[0_0_15px_rgba(20,241,149,0.1)]"
                : "border-white/5 bg-white/5 text-muted-silver hover:bg-white/10 hover:border-white/20"
            )}
          >
            {selected && (
              <Cpu className={cn("w-3.5 h-3.5", isIncognito ? "text-electric-purple" : "text-neon-cyan")} />
            )}
            {model.label}
            
            {/* Corner Deco */}
            {selected && (
              <div className={cn(
                "absolute -top-[1px] -right-[1px] w-2 h-2 border-t border-r rounded-tr-sm transition-colors",
                isIncognito ? "border-electric-purple" : "border-neon-cyan"
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
}

