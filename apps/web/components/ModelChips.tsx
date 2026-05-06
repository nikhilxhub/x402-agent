"use client";

import React from "react";
import { cn } from "../app/utils";

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
    <div className="flex flex-wrap gap-1.5">
      {models.map((model) => {
        const selected = selectedModel === model.id;

        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onSelect(model.id)}
            className={cn(
              "min-h-10 rounded-full border-px px-3.5 py-1.5",
              "font-sans text-12 font-medium transition-colors duration-[120ms] ease",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2",
              selected
                ? isIncognito
                  ? "border-[#444444] bg-[#333333] text-incognito-text"
                  : "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                : isIncognito
                  ? "border-incognito-border bg-transparent text-incognito-muted hover:bg-incognito-surface"
                  : "border-black/20 bg-transparent text-muted hover:bg-surface"
            )}
          >
            {model.label}
          </button>
        );
      })}
    </div>
  );
}
