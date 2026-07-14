// Consistent, deterministic neo-brutalist fills keyed on the category name, so a
// category is the same bold colour everywhere it appears (table badge, donut
// slice, budget bar, legend). Fills are bright on purpose — they always pair
// with dark text and an ink border. Income categories share a green family so
// money coming in reads differently from money going out.

const NAMED: Record<string, string> = {
  // Expenses
  Housing: "#fca5a5",
  Utilities: "#93c5fd",
  Groceries: "#bef264",
  Dining: "#fdba74",
  Transport: "#67e8f9",
  Travel: "#a5b4fc",
  Subscriptions: "#c4b5fd",
  Entertainment: "#f9a8d4",
  "Health & Fitness": "#5eead4",
  Shopping: "#fcd34d",
  Education: "#d8b4fe",
  Other: "#d4d4d8",
  // Income (green family)
  Salary: "#86efac",
  Freelance: "#6ee7b7",
  Investments: "#a7f3d0",
  Refunds: "#99f6e4",
  "Other Income": "#bbf7d0",
};

const FALLBACK = [
  "#fdba74",
  "#a5b4fc",
  "#5eead4",
  "#fca5a5",
  "#d8b4fe",
  "#fde68a",
  "#93c5fd",
];

export function categoryColor(name: string | null | undefined): string {
  const key = name ?? "Other";
  if (NAMED[key]) return NAMED[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
