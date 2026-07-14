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

  // Read the persisted preference after mount. Doing this in an effect (rather
  // than a lazy initializer) keeps the server and first client render in sync
  // ("USD") and avoids a hydration mismatch on the formatted amounts.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
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
