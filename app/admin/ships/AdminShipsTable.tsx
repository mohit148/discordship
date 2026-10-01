"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Ship, ShipStatus } from "@/types";
import { formatShortDate } from "@/lib/dates";
import { displayNameOf } from "@/lib/user-display";

export function AdminShipsTable({ ships }: { ships: Ship[] }) {
  const [rows, setRows] = useState(ships);
  const [confirmTarget, setConfirmTarget] = useState<{ ship: Ship; status: ShipStatus } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ship | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyStatus() {
    if (!confirmTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ships/${confirmTarget.ship.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: confirmTarget.status }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}). Check the server console for details.`);
        return;
      }

      setRows((prev) =>
        prev.map((s) => (s.id === confirmTarget.ship.id ? { ...s, status: confirmTarget.status } : s))
      );
      setConfirmTarget(null);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteShip() {
    if (!deleteTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ships/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      // Removing it from the list — not reassigning anything — is exactly
      // what renumbers the remaining rows with no gaps: the "#" column is
      // always just each row's position in `rows`.
      setRows((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-faint">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Ship</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Shipped</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ship, i) => (
              <tr key={ship.id} className="table-row-hover border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink-faint">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/ships/${ship.id}`} className="flex items-center gap-2 hover:opacity-80">
                    <Avatar src={ship.userA.avatarUrl} alt={displayNameOf(ship.userA)} size={22} />
                    <Avatar src={ship.userB.avatarUrl} alt={displayNameOf(ship.userB)} size={22} />
                    <span className="font-medium text-ink">
                      {displayNameOf(ship.userA)} × {displayNameOf(ship.userB)}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ship.status} />
                </td>
                <td className="px-4 py-3 text-ink-soft">{formatShortDate(ship.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-xs font-medium">
                    <Link href={`/ships/${ship.id}`} className="text-lavender-600 hover:underline">
                      Edit card
                    </Link>
                    {ship.status !== "ended" && (
                      <button
                        className="text-blossom-600 hover:underline"
                        onClick={() => setConfirmTarget({ ship, status: "ended" })}
                      >
                        End
                      </button>
                    )}
                    {ship.status !== "archived" && (
                      <button
                        className="text-ink-soft hover:underline"
                        onClick={() => setConfirmTarget({ ship, status: "archived" })}
                      >
                        Archive
                      </button>
                    )}
                    {(ship.status === "ended" || ship.status === "archived") && (
                      <button className="text-blossom-600 hover:underline" onClick={() => setDeleteTarget(ship)}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.status === "archived" ? "Archive this ship?" : "End this ship?"}
        description={error ?? "This won't delete anything — its history stays intact in the archive."}
        confirmLabel={submitting ? "Saving…" : "Confirm"}
        variant="danger"
        onConfirm={applyStatus}
        onCancel={() => {
          setConfirmTarget(null);
          setError(null);
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this ship permanently?"
        description={error ?? "Removes the ship, its card, and any reports about it everywhere on the site. This can't be undone."}
        confirmLabel={submitting ? "Deleting…" : "Delete permanently"}
        variant="danger"
        onConfirm={deleteShip}
        onCancel={() => {
          setDeleteTarget(null);
          setError(null);
        }}
      />
    </>
  );
}
