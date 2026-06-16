// Consistent, deterministic neo-brutalist fills keyed on the *effective*
// category name, so a category is the same bold colour everywhere it appears
// (table badge, pie slice, trend legend). Fills are bright on purpose — they
// always pair with dark text and an ink border.

const NAMED: Record<string, string> = {
  Subscriptions: "#c4b5fd", // violet
  Transport: "#67e8f9", // cyan
  "Food & Dining": "#bef264", // lime
  Shopping: "#fcd34d", // amber
  "Entertainment & Health": "#f9a8d4", // pink
};

const FALLBACK = [
  "#fdba74", // orange
  "#a5b4fc", // indigo
  "#5eead4", // teal
  "#fca5a5", // red
  "#d8b4fe", // purple
  "#fde68a", // yellow
  "#93c5fd", // blue
];

export function categoryColor(name: string | null | undefined): string {
  const key = name ?? "Uncategorized";
  if (NAMED[key]) return NAMED[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
