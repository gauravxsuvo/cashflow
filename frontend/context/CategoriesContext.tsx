"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Category, TransactionType } from "@/types";
import { api } from "@/lib/api";
import { fallbackColor } from "@/lib/categoryColors";

interface CategoriesContextValue {
  categories: Category[];
  loading: boolean;
  /** Category names valid for a transaction type. */
  namesForType: (type: TransactionType) => string[];
  /** Resolve a category name to its colour (server colour, else a stable fallback). */
  colorFor: (name: string | null | undefined) => string;
  kindOf: (name: string) => TransactionType | null;
  refresh: () => Promise<void>;
  create: (name: string, kind: TransactionType, color: string) => Promise<Category>;
  update: (name: string, patch: { new_name?: string; color?: string }) => Promise<Category>;
  remove: (name: string) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.categories);
    } catch {
      // Non-fatal: pickers fall back gracefully; a retry happens on next action.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byName = useMemo(() => {
    const m: Record<string, Category> = {};
    for (const c of categories) m[c.name] = c;
    return m;
  }, [categories]);

  const namesForType = useCallback(
    (type: TransactionType) => categories.filter((c) => c.kind === type).map((c) => c.name),
    [categories]
  );

  const colorFor = useCallback(
    (name: string | null | undefined) => {
      if (!name) return fallbackColor("Uncategorized");
      return byName[name]?.color ?? fallbackColor(name);
    },
    [byName]
  );

  const kindOf = useCallback((name: string) => byName[name]?.kind ?? null, [byName]);

  const create = useCallback(async (name: string, kind: TransactionType, color: string) => {
    const created = await api.createCategory(name, kind, color);
    setCategories((prev) => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(
    async (name: string, patch: { new_name?: string; color?: string }) => {
      const updated = await api.updateCategory(name, patch);
      setCategories((prev) => prev.map((c) => (c.name === name ? updated : c)));
      return updated;
    },
    []
  );

  const remove = useCallback(async (name: string) => {
    await api.deleteCategory(name);
    setCategories((prev) => prev.filter((c) => c.name !== name));
  }, []);

  return (
    <CategoriesContext.Provider
      value={{ categories, loading, namesForType, colorFor, kindOf, refresh, create, update, remove }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used within <CategoriesProvider>");
  return ctx;
}
