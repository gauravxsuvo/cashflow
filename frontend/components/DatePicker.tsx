"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

// Full Tailwind classNames — no react-day-picker default CSS needed
const DPC = {
  root: "w-64 select-none",
  months: "flex flex-col",
  month: "w-full",
  month_caption: "relative flex h-10 items-center justify-center mb-2",
  caption_label: "text-sm font-extrabold text-[var(--foreground)]",
  nav: "absolute inset-x-0 flex items-center justify-between pointer-events-none",
  button_previous:
    "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border-2 border-[var(--nb-ink)] " +
    "text-[var(--foreground)] transition-colors hover:bg-[var(--nb-surface-2)] focus:outline-none",
  button_next:
    "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border-2 border-[var(--nb-ink)] " +
    "text-[var(--foreground)] transition-colors hover:bg-[var(--nb-surface-2)] focus:outline-none",
  month_grid: "w-full border-collapse",
  weekdays: "",
  weekday: "text-xs font-bold text-[var(--nb-muted)] pb-2 text-center w-9",
  week: "",
  day: "text-center p-0.5",
  day_button:
    "h-9 w-9 rounded-md text-sm font-bold text-[var(--foreground)] transition-all duration-100 " +
    "focus:outline-none hover:bg-[var(--nb-surface-2)]",
  selected: "!bg-[var(--nb-primary)] !text-white border-2 border-[var(--nb-ink)] shadow-[2px_2px_0_0_var(--nb-ink)]",
  today: "font-extrabold ring-2 ring-inset ring-[var(--nb-primary)]",
  outside: "opacity-30",
  disabled: "opacity-25 cursor-not-allowed",
  hidden: "invisible",
} as const;

interface DatePickerProps {
  value: string; // ISO "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
  required?: boolean;
}

export default function DatePicker({ value, onChange, required }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const selectedDate = parsed && isValid(parsed) ? parsed : undefined;
  const displayLabel = selectedDate ? format(selectedDate, "MMM d, yyyy") : "";

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="nb-input flex items-center gap-2 text-left"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--nb-muted)]" />
        <span className={displayLabel ? "font-semibold text-[var(--foreground)]" : "font-medium text-[var(--nb-muted)]"}>
          {displayLabel || "Select a date"}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="nb-card absolute left-0 top-full z-50 mt-2 p-4 text-[var(--foreground)]"
          >
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              defaultMonth={selectedDate ?? new Date()}
              classNames={DPC}
              components={{
                Chevron: ({ orientation }) =>
                  orientation === "left" ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  ),
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {required && (
        <input aria-hidden tabIndex={-1} className="sr-only" value={value} onChange={() => {}} required />
      )}
    </div>
  );
}
