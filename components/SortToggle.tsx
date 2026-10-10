"use client";

export type SortOrder = "newest" | "oldest";

/**
 * Only changes display order — a ship's own permanent number (assigned at
 * creation, #1 = first ever created) never changes no matter which way
 * this is set.
 */
export function SortToggle({ value, onChange }: { value: SortOrder; onChange: (v: SortOrder) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOrder)}
      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink-soft focus:border-lavender-400 sm:w-auto"
      aria-label="Sort order"
    >
      <option value="newest">Newest → Oldest</option>
      <option value="oldest">Oldest → Newest</option>
    </select>
  );
}
