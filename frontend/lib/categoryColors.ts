// A stable, deterministic fallback colour for a category name — used when the
// category has no colour from the server (e.g. a legacy or just-deleted name).
// The authoritative colours live per-user in the categories table and are
// resolved via CategoriesContext.colorFor().

const PALETTE = [
  "#fca5a5",
  "#93c5fd",
  "#bef264",
  "#fdba74",
  "#67e8f9",
  "#a5b4fc",
  "#c4b5fd",
  "#f9a8d4",
  "#5eead4",
  "#fcd34d",
  "#d8b4fe",
  "#86efac",
];

export function fallbackColor(name: string | null | undefined): string {
  const key = name ?? "Uncategorized";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** @deprecated Prefer CategoriesContext.colorFor(); kept for non-context callers. */
export function categoryColor(name: string | null | undefined): string {
  return fallbackColor(name);
}
