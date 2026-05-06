"use client";

import React from "react";
import { cn } from "../app/utils";

export function StatusBar({
  status,
  isIncognito,
  onRetry,
}: {
  status: "pending" | "success" | "error";
  isIncognito: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      className={cn(
        "animate-fade-in flex items-center gap-2 rounded-lg px-3.5 py-2.5 font-sans text-12 font-medium",
        status === "pending" && "bg-status-pending-bg text-status-pending-text",
        status === "success" && "bg-status-success-bg text-status-success-text",
        status === "error" && "bg-status-error-bg text-status-error-text"
      )}
    >
      {status === "pending" ? (
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current animate-pulse-dot" />
      ) : null}
      {status === "success" ? <span className="flex-shrink-0">{"\u2713"}</span> : null}
      {status === "error" ? <span className="flex-shrink-0">{"\u2715"}</span> : null}

      <span className="flex-1">
        {status === "pending" && (isIncognito ? "Scanning for matching Umbra UTXO..." : "Scanning chain for payment...")}
        {status === "success" && "Verified · response below"}
        {status === "error" && "Payment not found - check wallet and retry"}
      </span>

      {status === "error" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto flex-shrink-0 font-sans text-12 font-medium text-status-error-text underline"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
