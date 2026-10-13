import type { ShipStatus } from "@/types";

const STYLES: Record<ShipStatus, string> = {
  confirmed: "bg-sage-50 text-sage-500 border-sage-100",
  pending: "bg-amber-50 text-amber-500 border-amber-100",
  ended: "bg-blossom-50 text-blossom-600 border-blossom-100",
  archived: "bg-cream-200 text-ink-soft border-border",
};

const LABELS: Record<ShipStatus, string> = {
  confirmed: "Current",
  pending: "Pending",
  ended: "Ended",
  archived: "Archived",
};

export function StatusBadge({ status }: { status: ShipStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
