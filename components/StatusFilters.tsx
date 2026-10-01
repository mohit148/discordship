"use client";

import type { ShipStatus } from "@/types";

// Public-facing filter only: pending (awaiting the other person, or an
// admin-created ship awaiting confirmation) and archived are internal
// states for the admin/request system and are never shown here — the ship
// list this filters is already restricted to confirmed/ended ships before
// it gets here (see app/ships/page.tsx).
const OPTIONS: { value: ShipStatus | "all"; label: string }[] = [
  { value: "confirmed", label: "Current Ships" },
  { value: "ended", label: "Ended" },
  { value: "all", label: "All" },
];

export function StatusFilters({
  value,
  onChange,
}: {
  value: ShipStatus | "all";
  onChange: (value: ShipStatus | "all") => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-white p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            value === opt.value
              ? "bg-lavender-100 font-medium text-lavender-600"
              : "text-ink-soft hover:bg-cream-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
