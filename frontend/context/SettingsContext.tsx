"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface Settings {
  currency: string;
  setCurrency: (code: string) => void;
}

const SettingsContext = createContext<Settings | null>(null);

const STORAGE_KEY = "pf_currency";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState("USD");

  // Read persisted preference after mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Hydrating preference from localStorage (a client-only external store)
    // after mount, by design — avoids an SSR mismatch on first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setCurrencyState(saved);
  }, []);

  function setCurrency(code: string) {
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }

  return (
    <SettingsContext.Provider value={{ currency, setCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}
