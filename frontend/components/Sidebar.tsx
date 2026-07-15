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
  ListOrdered,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

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
    <div className="flex h-full flex-col gap-5 border-r-2 border-[var(--border)] p-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-1 pt-1 text-[var(--foreground)]">
        <Logo size={36} />
        <span className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">
          Cashflow
        </span>
      </div>

      {/* Prominent add */}
      <button onClick={onAdd} className="nb-btn nb-btn-primary w-full py-2.5 text-sm uppercase tracking-wide">
        <Plus className="h-4 w-4" />
        Add transaction
      </button>

      {/* Section nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.filter((n) => !n.accountsOnly || showAccounts).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="group flex items-center gap-3 rounded-[3px] border-2 border-transparent px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </button>
        ))}
      </nav>

      <div className="h-0.5 bg-[var(--border)]" />

      {/* Tools */}
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onOpenCategories}
          className="flex items-center gap-3 rounded-[3px] border-2 border-transparent px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <Tag className="h-[18px] w-[18px]" />
          Categories
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-3 rounded-[3px] border-2 border-transparent px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <Download className="h-[18px] w-[18px]" />
          Export CSV
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-3 rounded-[3px] border-2 border-transparent px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <SettingsIcon className="h-[18px] w-[18px]" />
          Settings
        </button>
      </div>

      {/* Footer: user + theme */}
      <div className="mt-auto flex items-center gap-2 rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface-2)] p-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--primary)] text-sm font-black text-white">
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
