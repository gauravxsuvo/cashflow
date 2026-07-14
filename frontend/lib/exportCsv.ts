import type { Transaction } from "@/types";
import { effectiveCategory, signedAmount } from "@/lib/transactions";

function escapeCsvField(value: string): string {
  // Wrap in quotes if the field contains a comma, quote, or newline
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportTransactionsCsv(transactions: Transaction[]): void {
  const header = [
    "Date",
    "Description",
    "Type",
    "Amount",
    "Signed Amount",
    "Category",
    "Source",
    "Account",
    "Note",
  ];

  const rows = transactions.map((tx) => {
    const category = effectiveCategory(tx);
    const source = tx.manual_category ? "Manual" : "Auto";
    return [
      escapeCsvField(tx.date ?? ""),
      escapeCsvField(tx.vendor ?? "Unknown"),
      tx.type,
      tx.amount != null ? tx.amount.toFixed(2) : "",
      signedAmount(tx).toFixed(2),
      escapeCsvField(category),
      source,
      escapeCsvField(tx.account ?? ""),
      escapeCsvField(tx.note ?? ""),
    ];
  });

  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cashflow_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
}
