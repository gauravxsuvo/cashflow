"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@/types";
import { api, getToken, setToken, setUnauthorizedHandler } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface AuthContextValue {
  user: User | null;
  /** true only during the initial "do we have a valid session?" check. */
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setCurrency: (code: string) => void;
  /** Merge fields into the current user (e.g. after a settings change). */
  patchUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const currencyReq = useRef(0);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // On a 401 from anywhere, drop the session so the UI returns to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (getToken()) {
        setToken(null);
        setUser(null);
        toast("Your session expired. Please sign in again.", "info");
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [toast]);

  // Restore a session on first load if a token is present.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!getToken()) {
        setInitializing(false);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await api.register(username, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const setCurrency = useCallback(
    (code: string) => {
      setUser((prev) => (prev ? { ...prev, currency: code } : prev));
      const reqId = ++currencyReq.current;
      api.changeCurrency(code).catch(() => {
        // Only surface/rollback if this is still the latest request.
        if (reqId === currencyReq.current) {
          toast("Could not save currency preference", "error");
        }
      });
    },
    [toast]
  );

  return (
    <AuthContext.Provider
      value={{ user, initializing, login, register, logout, setCurrency, patchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
