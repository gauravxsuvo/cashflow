"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // next-themes resolves the theme on the client only; render an inert
  // placeholder of identical size until mounted to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  // One-shot mount flag to avoid an SSR/client hydration mismatch — the
  // documented "sync with an external system" exception to this rule.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div aria-hidden className="nb-icon-btn h-10 w-10" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="nb-icon-btn h-10 w-10"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
