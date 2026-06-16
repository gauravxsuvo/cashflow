import type { Transaction } from "@/types";

function escapeCsvField(value: string): string {
  // Wrap in quotes if the field contains a comma, quote, or newline
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportTransactionsCsv(transactions: Transaction[]): void {
  const header = ["Date", "Vendor", "Amount", "Category", "Source"];

  const rows = transactions.map((tx) => {
    // Export the *effective* category the user actually sees, plus whether it
    // came from a manual override or the ML cluster.
    const effective = tx.manual_category ?? tx.cluster_name ?? "Uncategorized";
    const source = tx.manual_category ? "Manual" : "ML";
    return [
      escapeCsvField(tx.date ?? ""),
      escapeCsvField(tx.vendor ?? "Unknown"),
      tx.amount != null ? tx.amount.toFixed(2) : "",
      escapeCsvField(effective),
      source,
    ];
  });

  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
}
