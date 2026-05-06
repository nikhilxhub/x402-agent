"use client";

import React from "react";
import { cn } from "../app/utils";

export function QuoteBlock({
  price,
  modelLabel,
  currency,
  isIncognito,
  isPhantomWallet,
}: {
  price: string;
  modelLabel: string;
  currency: string;
  isIncognito: boolean;
  isPhantomWallet: boolean;
}) {
  return (
    <div className="animate-slide-down space-y-2">
      {isIncognito ? (
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-incognito-muted" />
          <span className="font-sans text-10 font-medium uppercase tracking-widest text-incognito-muted">
            Private · Umbra
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-lg px-4 py-3.5",
          isIncognito ? "bg-incognito-surface" : "bg-surface"
        )}
      >
        <p
          className={cn(
            "font-serif-italic text-32 leading-none",
            isIncognito ? "text-incognito-text" : "text-[#1a1a1a]"
          )}
        >
          {price}
        </p>
        <p
          className={cn(
            "mt-1 font-sans text-11 font-normal",
            isIncognito ? "text-incognito-muted" : "text-muted"
          )}
        >
          per inference · {modelLabel} · {currency}
          {isIncognito ? " · link between wallets masked" : ""}
        </p>
      </div>

      {isIncognito && isPhantomWallet ? (
        <div className="rounded-lg border-px border-warn-dark-text/20 bg-warn-dark-bg px-3.5 py-2.5 font-sans text-12 font-normal text-warn-dark-text">
          {"\u26A0  "}Your connected wallet (Phantom) does not support private payments.
          {" "}Switch to Solflare to use incognito mode.{" "}
          <a
            href="https://solflare.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            How to switch ↗
          </a>
        </div>
      ) : null}
    </div>
  );
}
