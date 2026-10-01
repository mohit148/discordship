"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ShipStatus } from "@/types";

export function ShipActions({ shipId, currentStatus }: { shipId: string; currentStatus: ShipStatus }) {
  const [confirming, setConfirming] = useState<"end" | "delete" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (currentStatus === "archived") return null;

  async function handleEnd() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ships/${shipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}). Check the server console for details.`);
        return;
      }
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ships/${shipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ships/${shipId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      router.push("/ships");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-1.5">
      {currentStatus === "ended" ? (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleArchive} disabled={submitting}>
            {submitting ? "…" : "Archive"}
          </Button>
          <Button variant="danger" onClick={() => setConfirming("delete")}>
            Delete Permanently
          </Button>
        </div>
      ) : (
        <Button variant="danger" onClick={() => setConfirming("end")}>
          End this ship
        </Button>
      )}
      {error && <p className="text-xs text-blossom-600">{error}</p>}

      <ConfirmDialog
        open={confirming === "end"}
        title="End this ship?"
        description="This moves the ship to Ended. You can archive or permanently delete it afterward."
        confirmLabel={submitting ? "Ending…" : "End ship"}
        variant="danger"
        onConfirm={handleEnd}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        title="Delete this ship permanently?"
        description="This removes the ship, its card, and any reports about it everywhere on the site. This can't be undone — archive it instead if you just want it out of the way."
        confirmLabel={submitting ? "Deleting…" : "Delete permanently"}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
