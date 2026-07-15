// A stable, deterministic fallback colour for a category name — used when the
// category has no colour from the server (e.g. a legacy or just-deleted name).
// The authoritative colours live per-user in the categories table and are
// resolved via CategoriesContext.colorFor().

const PALETTE = [
  "#e63329",
  "#144eb8",
  "#1f8a4c",
  "#e8792b",
  "#159aa8",
  "#7a3fb0",
  "#3b5bdb",
  "#d6336c",
  "#0ca678",
  "#f6c019",
  "#e6a817",
  "#495057",
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
