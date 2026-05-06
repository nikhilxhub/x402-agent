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
    <div>
      <p
        className={cn(
          "mb-3 font-sans text-10 font-medium uppercase tracking-widest",
          isIncognito ? "text-incognito-muted" : "text-muted-light"
        )}
      >
        Response
      </p>

      <p
        className={cn(
          "font-sans text-14 font-normal leading-[1.75]",
          isStreaming && "typewriter-cursor",
          isIncognito ? "text-incognito-text" : "text-[#1a1a1a]"
        )}
      >
        {text}
      </p>
    </div>
  );
}
