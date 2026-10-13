"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { relativeTimeSince } from "@/lib/dates";
import { displayNameOf } from "@/lib/user-display";
import type { ShipRequest } from "@/types";

/**
 * One row in the current user's request inbox. `direction` controls which
 * buttons show: "incoming" requests can be accepted/declined (the viewer is
 * the recipient), "outgoing" requests can only be cancelled (the viewer is
 * the sender). Both hit the same /api/requests/[id] PATCH route used by the
 * admin panel's approve/reject flow, just with the actions a non-admin
 * participant is actually allowed to take.
 */
export function RequestInboxRow({ request, direction }: { request: ShipRequest; direction: "incoming" | "outgoing" }) {
  const [resolved, setResolved] = useState<"accepted" | "declined" | "cancelled" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const otherUser = direction === "incoming" ? request.fromUser : request.toUser;

  async function respond(action: "accept" | "decline" | "cancel") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}). Check the server console for details.`);
        return;
      }

      setResolved(action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (resolved) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2.5 opacity-60">
        <div className="flex items-center gap-2.5">
          <Avatar src={otherUser.avatarUrl} alt={displayNameOf(otherUser)} size={28} />
          <p className="text-sm text-ink">{displayNameOf(otherUser)}</p>
        </div>
        <span className="text-xs text-ink-faint">
          {resolved === "accepted" ? "Accepted" : resolved === "declined" ? "Declined" : "Cancelled"}
        </span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar src={otherUser.avatarUrl} alt={displayNameOf(otherUser)} size={28} />
          <div>
            <p className="text-sm text-ink">{displayNameOf(otherUser)}</p>
            <p className="text-xs text-ink-faint">{relativeTimeSince(request.createdAt)}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {direction === "incoming" ? (
            <>
              <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => respond("accept")} disabled={submitting}>
                {submitting ? "…" : "Accept"}
              </Button>
              <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => respond("decline")} disabled={submitting}>
                {submitting ? "…" : "Decline"}
              </Button>
            </>
          ) : (
            <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => respond("cancel")} disabled={submitting}>
              {submitting ? "…" : "Cancel"}
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-blossom-600">{error}</p>}
    </li>
  );
}
