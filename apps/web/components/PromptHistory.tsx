"use client";

import React from "react";
import { cn } from "../app/utils";

export type HistoryItem = {
  id: string;
  modelLabel: string;
  prompt: string;
  cost: string;
  currency: string;
  mode: "standard" | "private";
};

export function PromptHistory({
  history,
  onClear,
}: {
  history: HistoryItem[];
  onClear: () => void;
}) {
  if (!history.length) {
    return (
      <p className="py-6 text-center font-sans text-13 font-normal text-muted-light">
        No prompts yet - run your first inference above.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-sans text-13 font-medium text-[#1a1a1a]">History</span>
        <button
          type="button"
          onClick={onClear}
          className="font-sans text-12 font-normal text-muted hover:underline"
        >
          Clear
        </button>
      </div>

      <div className="divide-y divide-black/[0.07]">
        {history.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 py-2.5">
            <span
              className={cn(
                "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                item.mode === "private" ? "bg-[#555555]" : "bg-[#1a1a1a]"
              )}
            />
            <span className="hidden min-w-[120px] font-sans text-12 font-medium text-[#1a1a1a] sm:block">
              {item.modelLabel}
            </span>
            <span className="flex-1 truncate font-sans text-12 font-normal text-muted">
              {item.prompt}
            </span>
            <span className="min-w-[70px] text-right font-sans text-12 font-normal tabular-nums text-muted-light">
              {item.cost} {item.currency}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
