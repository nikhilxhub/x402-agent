"use client";

import React from "react";
import { cn } from "../app/utils";

const STEPS = [
  { n: 1 as const, title: "Pick model & enter prompt", desc: "Choose a model and type your prompt" },
  { n: 2 as const, title: "Quote received", desc: "Payment required before inference" },
  { n: 3 as const, title: "Sign & pay", desc: "Confirm the transaction in your wallet" },
  { n: 4 as const, title: "Verify & respond", desc: "On-chain verification to AI response" },
];

export function StepIndicator({
  currentStep,
  isIncognito,
}: {
  currentStep: 1 | 2 | 3 | 4;
  isIncognito: boolean;
}) {
  return (
    <>
      <p
        className={cn(
          "font-sans text-13 font-medium sm:hidden",
          isIncognito ? "text-incognito-muted" : "text-muted"
        )}
      >
        Step {currentStep} of 4 - {STEPS[currentStep - 1]!.title}
      </p>

      <div className="hidden flex-col gap-4 sm:flex">
        {STEPS.map((step) => {
          const done = currentStep > step.n;
          const active = currentStep === step.n;

          return (
            <div key={step.n} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-px",
                  "font-sans text-11 font-medium transition-all duration-150 ease",
                  done
                    ? "border-status-success-bg bg-status-success-bg text-status-success-text"
                    : active
                      ? isIncognito
                        ? "border-incognito-text bg-incognito-text text-incognito-bg"
                        : "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                      : isIncognito
                        ? "border-incognito-border bg-transparent text-incognito-muted"
                        : "border-black/15 bg-transparent text-muted-light"
                )}
              >
                {done ? "\u2713" : step.n}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-sans text-13 font-medium leading-snug",
                    active || done
                      ? isIncognito
                        ? "text-incognito-text"
                        : "text-[#1a1a1a]"
                      : isIncognito
                        ? "text-incognito-muted"
                        : "text-muted"
                  )}
                >
                  {step.title}
                </p>
                {active ? (
                  <p
                    className={cn(
                      "mt-0.5 font-sans text-12 font-normal",
                      isIncognito ? "text-incognito-muted" : "text-muted"
                    )}
                  >
                    {step.desc}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
