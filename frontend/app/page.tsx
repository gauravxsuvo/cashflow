"use client";

import { useAuth } from "@/context/AuthContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";
import Logo from "@/components/Logo";

export default function Page() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[var(--foreground)]">
          <Logo size={56} className="animate-pulse" />
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Loading your cashflow…
          </p>
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
