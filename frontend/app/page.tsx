"use client";

import { useAuth } from "@/context/AuthContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";
import { Wallet } from "lucide-react";

export default function Page() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="nb-card flex h-16 w-16 animate-pulse items-center justify-center rounded-[20px]">
            <Wallet className="h-7 w-7 text-[var(--primary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--muted)]">Loading your cashflow…</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <CategoriesProvider>
      <Dashboard />
    </CategoriesProvider>
  );
}
