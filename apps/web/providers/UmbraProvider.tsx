"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type PaymentMethod = "standard" | "umbra";

interface UmbraContextType {
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  isIncognito: boolean;
  toggleIncognito: () => void;
}

const UmbraContext = createContext<UmbraContextType | undefined>(undefined);

export function UmbraProvider({ children }: { children: ReactNode }) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("standard");

  const toggleIncognito = () => {
    setPaymentMethod((prev) => (prev === "standard" ? "umbra" : "standard"));
  };

  const isIncognito = paymentMethod === "umbra";

  return (
    <UmbraContext.Provider
      value={{
        paymentMethod,
        setPaymentMethod,
        isIncognito,
        toggleIncognito,
      }}
    >
      {children}
    </UmbraContext.Provider>
  );
}

export function useUmbra() {
  const context = useContext(UmbraContext);
  if (context === undefined) {
    throw new Error("useUmbra must be used within an UmbraProvider");
  }
  return context;
}
