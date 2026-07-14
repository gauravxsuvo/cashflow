"use client";

import {
  BarChart3,
  Download,
  LayoutDashboard,
  Landmark,
  LogOut,
  Plus,
  Settings as SettingsIcon,
  Tag,
  Target,
  Wallet,
  ListOrdered,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";

interface SidebarProps {
  onAdd: () => void;
  onExport: () => void;
  onOpenCategories: () => void;
  onOpenSettings: () => void;
  onNavigate: (id: string) => void;
  showAccounts: boolean;
}

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "spending", label: "Spending", icon: BarChart3 },
  { id: "accounts", label: "Accounts", icon: Landmark, accountsOnly: true },
  { id: "budgets", label: "Budgets", icon: Target },
  { id: "transactions", label: "Transactions", icon: ListOrdered },
];

export default function Sidebar({
  onAdd,
  onExport,
  onOpenCategories,
  onOpenSettings,
  onNavigate,
  showAccounts,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const initial = (user?.username ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col gap-5 p-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-1 pt-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] shadow-[0_8px_22px_-8px_var(--ring)]">
          <Wallet className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">Cashflow</span>
      </div>

      {/* Prominent add */}
      <button onClick={onAdd} className="nb-btn nb-btn-primary w-full py-2.5 text-sm">
        <Plus className="h-4 w-4" />
        Add transaction
      </button>

      {/* Section nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.filter((n) => !n.accountsOnly || showAccounts).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </button>
        ))}
      </nav>

      <div className="h-px bg-[var(--hairline)]" />

      {/* Tools */}
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onOpenCategories}
          className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <Tag className="h-[18px] w-[18px]" />
          Categories
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <Download className="h-[18px] w-[18px]" />
          Export CSV
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <SettingsIcon className="h-[18px] w-[18px]" />
          Settings
        </button>
      </div>

      {/* Footer: user + theme */}
      <div className="mt-auto flex items-center gap-2 rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-2)] p-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-sm font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{user?.username}</p>
          <p className="text-[0.68rem] text-[var(--muted)]">{user?.currency}</p>
        </div>
        <ThemeToggle />
        <button
          onClick={logout}
          aria-label="Log out"
          title="Log out"
          className="nb-icon-btn h-9 w-9 hover:!text-[var(--neg)]"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
