"use client";

export function SearchBar({
  value,
  onChange,
  placeholder = "Search users or ships...",
  className = "max-w-sm",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Width classes for the wrapper — defaults to a compact bar; list pages pass "max-w-none" to fill their row. */
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-ink shadow-softer transition-colors placeholder:text-ink-faint hover:border-lavender-200 focus:border-lavender-400 focus:outline-none focus:ring-2 focus:ring-lavender-100"
      />
    </div>
  );
}
