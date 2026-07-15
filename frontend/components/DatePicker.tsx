"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { usePopover } from "@/hooks/usePopover";

// Full Tailwind classNames — no react-day-picker default CSS needed.
// Every column is a fixed 36px, so the weekday header row and the day grid
// always line up, and the whole calendar stays a predictable 252px wide
// (fits comfortably inside modals on the smallest phones).
const DPC = {
  root: "w-[252px] select-none",
  months: "flex flex-col",
  month: "relative w-full",
  month_caption: "relative flex h-9 items-center justify-center mb-1",
  caption_label: "text-sm font-bold text-[var(--foreground)]",
  nav: "pointer-events-none absolute inset-x-0 top-0 flex h-9 items-center justify-between",
  button_previous:
    "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg " +
    "text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] " +
    "focus:outline-none disabled:opacity-30 disabled:hover:bg-transparent",
  button_next:
    "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg " +
    "text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] " +
    "focus:outline-none disabled:opacity-30 disabled:hover:bg-transparent",
  month_grid: "border-collapse",
  weekdays: "",
  weekday: "h-8 w-9 text-center align-middle text-[0.7rem] font-semibold text-[var(--muted)]",
  week: "",
  day: "p-0 text-center align-middle",
  day_button:
    "mx-auto flex h-9 w-9 items-center justify-center rounded-[3px] text-sm font-semibold " +
    "text-[var(--foreground)] transition-colors focus:outline-none hover:bg-[var(--surface-2)]",
  selected:
    "!bg-[var(--primary)] !text-white hover:!bg-[var(--primary)] !border-2 !border-[var(--foreground)]",
  today: "font-black text-[var(--primary)] underline",
  outside: "opacity-40",
  disabled: "opacity-30 cursor-not-allowed hover:!bg-transparent",
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { placement, measure } = usePopover();

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
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) measure(triggerRef.current, 380);
          setOpen((o) => !o);
        }}
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
            className={`nb-card absolute left-0 z-50 p-3 text-[var(--foreground)] shadow-[var(--shadow-lg)] ${
              placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
            }`}
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
