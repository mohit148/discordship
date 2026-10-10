"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/Button";
import type { Ship, ShipStatus } from "@/types";
import { formatShortDate } from "@/lib/dates";
import { displayNameOf } from "@/lib/user-display";

type SortOrder = "newest" | "oldest";
type AdminStatusFilter = ShipStatus | "all";

const STATUS_OPTIONS: { value: AdminStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Current" },
  { value: "ended", label: "Ended" },
  { value: "archived", label: "Archived" },
];

export function AdminShipsTable({ ships }: { ships: Ship[] }) {
  const [rows, setRows] = useState(ships);
  const [status, setStatus] = useState<AdminStatusFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [confirmTarget, setConfirmTarget] = useState<{ ship: Ship; status: ShipStatus } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ship | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // This is the single list everything downstream uses — the table rows
  // (so the "#" column, Copy, and Download always agree with what's on
  // screen), Copy, and Download. `rows` already arrives newest-first from
  // the server, so "oldest" just reverses it; filtering by status happens
  // here too, rather than only affecting the exported text.
  const visible = useMemo(() => {
    const filtered = status === "all" ? rows : rows.filter((s) => s.status === status);
    return sort === "oldest" ? [...filtered].reverse() : filtered;
  }, [rows, status, sort]);

  function formattedList(): string {
    return visible.map((s, i) => `${i + 1}. ${displayNameOf(s.userA)} x ${displayNameOf(s.userB)}`).join("\n");
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(formattedList());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy — your browser may be blocking clipboard access.");
    }
  }

  function downloadList() {
    const blob = new Blob([formattedList()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ships.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

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
      // Removing it from `rows` — not reassigning anything — is exactly
      // what renumbers the remaining rows (and the exported list) with no
      // gaps: the "#" is always just each ship's position in `visible`.
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
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-white p-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                status === opt.value ? "bg-lavender-100 font-medium text-lavender-600" : "text-ink-soft hover:bg-cream-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOrder)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink-soft focus:border-lavender-400 sm:w-auto"
            aria-label="Export / display order"
          >
            <option value="newest">Newest → Oldest</option>
            <option value="oldest">Oldest → Newest</option>
          </select>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={copyList} className="flex-1 sm:flex-none">
              {copied ? "Copied!" : "Copy Ships"}
            </Button>
            <Button variant="secondary" onClick={downloadList} className="flex-1 sm:flex-none">
              Download Ships
            </Button>
          </div>
        </div>
      </div>
      {error && <p className="mb-2 text-xs text-blossom-600">{error}</p>}

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
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-faint">
                  No ships match that filter.
                </td>
              </tr>
            )}
            {visible.map((ship, i) => (
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
