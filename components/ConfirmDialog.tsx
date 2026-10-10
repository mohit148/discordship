"use client";

import { Button } from "./Button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-5 shadow-soft">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1.5 text-sm text-ink-soft">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
