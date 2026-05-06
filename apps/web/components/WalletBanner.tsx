"use client";

import React from "react";
import { cn } from "../app/utils";

export function WalletBanner({ isIncognito }: { isIncognito: boolean }) {
  return (
    <div
      className={cn(
        "mb-4 rounded-lg border-px px-3.5 py-2.5",
        "font-sans text-12 font-normal transition-all duration-[250ms] ease-in-out",
        isIncognito
          ? "border-incognito-border bg-incognito-surface text-incognito-muted"
          : "border-black/10 bg-surface text-muted"
      )}
    >
      {isIncognito ? (
        <>
          <span className="text-warn-dark-text">{"\u26A0"}</span>
          {"  "}Private payments require{" "}
          <span className="font-medium text-incognito-text">Solflare</span>
          {" "}or the{" "}
          <span className="font-medium text-incognito-text">Umbra wallet</span>.
          {" "}Phantom does not support Umbra stealth addresses and cannot complete private payments.
        </>
      ) : (
        <>
          {"\u2139  "}Standard payments work with any Solana wallet -{" "}
          <span className="font-medium text-[#1a1a1a]">Phantom</span>,{" "}
          <span className="font-medium text-[#1a1a1a]">Backpack</span>,{" "}
          <span className="font-medium text-[#1a1a1a]">Solflare</span>, etc.
        </>
      )}
    </div>
  );
}
