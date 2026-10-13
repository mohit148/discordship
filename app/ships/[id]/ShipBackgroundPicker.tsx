"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ShipCard } from "@/components/ShipCard";
import type { BackgroundPreset, Ship } from "@/types";

/**
 * Choose the card's background — from the admin-managed catalog only, there
 * is no custom upload. Each option is a small live preview of this very
 * card. Like the bio, a change is proposed and the other person approves it
 * from Requests (mode "propose"); on an admin-created ship an admin's pick
 * applies directly (mode "direct").
 */
export function ShipBackgroundPicker({
  ship,
  backgrounds,
  canEdit,
  mode = "propose",
  notice,
}: {
  ship: Ship;
  backgrounds: BackgroundPreset[];
  canEdit: boolean;
  mode?: "propose" | "direct";
  notice?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(ship.background?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function save() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ships/${ship.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundId: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      if (mode === "propose") setFlash("Sent — it'll change once the other person approves it.");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5">
      {!open ? (
        canEdit && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-faint">{(flash || notice) ?? ""}</p>
            <button
              onClick={() => {
                setFlash(null);
                setOpen(true);
              }}
              className="text-xs font-medium text-ink-soft hover:text-ink"
            >
              Change background
            </button>
          </div>
        )
      ) : backgrounds.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-ink-faint">
            No backgrounds have been added to the catalog yet.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2.5">
            {backgrounds.map((bg) => {
              const isSelected = selected === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setSelected(bg.id)}
                  className={`rounded-xl text-left transition ${
                    isSelected ? "ring-2 ring-lavender-500 ring-offset-2" : "hover:opacity-90"
                  }`}
                  aria-pressed={isSelected}
                >
                  <ShipCard ship={{ ...ship, background: bg }} size="compact" href={false} />
                  <span className="mt-1 block truncate text-center text-xs text-ink-soft">{bg.name}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-faint">
            {mode === "direct"
              ? "This applies right away — this ship isn't on the mutual-approval system."
              : "The other person will need to approve this before the card changes."}
          </p>
          {error && <p className="text-xs text-blossom-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setSelected(ship.background?.id ?? null);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={submitting || !selected || selected === ship.background?.id}>
              {submitting ? "Saving…" : mode === "direct" ? "Save" : "Propose change"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
