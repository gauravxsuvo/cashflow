"use client";

import { useAuth } from "@/context/AuthContext";

interface Settings {
  currency: string;
  setCurrency: (code: string) => void;
}

/**
 * Currency now lives on the authenticated user (persisted server-side), so it
 * follows the account across devices. This hook keeps the original
 * `useSettings()` surface so existing components need no changes.
 */
export function useSettings(): Settings {
  const { user, setCurrency } = useAuth();
  return { currency: user?.currency ?? "USD", setCurrency };
}
