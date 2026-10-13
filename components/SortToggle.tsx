"use client";

import { Select } from "./Select";

export type SortOrder = "newest" | "oldest";

const OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest → Oldest" },
  { value: "oldest", label: "Oldest → Newest" },
];

/**
 * Only changes display order. The "#" in the lists is just each row's position.
 */
export function SortToggle({ value, onChange }: { value: SortOrder; onChange: (v: SortOrder) => void }) {
  return <Select value={value} onChange={onChange} options={OPTIONS} ariaLabel="Sort order" className="w-full sm:w-auto" />;
}
