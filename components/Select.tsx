"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

/**
 * The site's one dropdown. Looks like the rest of the UI (soft border, rounded
 * panel, lavender highlight) instead of the browser's boxy native list, and
 * behaves like a normal <select>: click or Enter/Space/↓ to open, ↑/↓ to move,
 * Enter to pick, Esc or click-away to close.
 *
 * The panel is positioned with `fixed` from the trigger's rectangle, so it is
 * never clipped by a scrolling table or card it sits inside. It closes on
 * scroll/resize rather than trying to follow the trigger around.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  className = "",
  compact = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  ariaLabel: string;
  disabled?: boolean;
  /** Extra classes for the trigger button (e.g. "w-full sm:w-auto"). */
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  function openMenu() {
    const el = triggerRef.current;
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    const needed = Math.min(options.length * 38 + 12, 320);
    const up = window.innerHeight - r.bottom < needed + 12 && r.top > needed + 12;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: Math.max(r.width, 176), up });
    setActive(selectedIndex);
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(i: number) {
    const opt = options[i];
    if (opt) onChange(opt.value);
    close();
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-white text-ink-soft shadow-softer transition-colors hover:border-lavender-200 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender-200 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-lavender-400 text-ink" : ""
        } ${compact ? "px-2.5 py-1.5 text-sm" : "px-3.5 py-2 text-sm"} ${className}`}
      >
        <span className="truncate">{selected?.label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "fixed",
            left: pos.left,
            minWidth: pos.width,
            ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
          }}
          className="z-50 max-h-80 overflow-y-auto rounded-2xl border border-border bg-white p-1.5 shadow-pop"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === active ? "bg-cream-100 text-ink" : "text-ink-soft"
                } ${isSelected ? "font-medium text-lavender-600" : ""}`}
              >
                {opt.label}
                {isSelected && (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                    <path d="m4.5 10.5 3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
