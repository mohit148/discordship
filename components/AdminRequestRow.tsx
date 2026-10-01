"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarPair } from "./Avatar";
import { Button } from "./Button";
import { relativeTimeSince } from "@/lib/dates";
import type { ShipRequest } from "@/types";
import { displayNameOf } from "@/lib/user-display";

export function AdminRequestRow({ request }: { request: ShipRequest }) {
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function respond(action: "approve" | "reject") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}). Check the server console for details.`);
        return;
      }

      setResolved(action === "approve" ? "approved" : "rejected");
      router.refresh();
    } catch (err) {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (resolved) {
    return (
      <li className="flex items-center justify-between gap-3 opacity-60">
        <div className="flex items-center gap-2.5">
          <AvatarPair a={request.fromUser} b={request.toUser} size={26} />
          <p className="text-sm text-ink">
            {displayNameOf(request.fromUser)} × {displayNameOf(request.toUser)}
          </p>
        </div>
        <span className="text-xs text-ink-faint">{resolved === "approved" ? "Approved" : "Rejected"}</span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AvatarPair a={request.fromUser} b={request.toUser} size={26} />
          <div>
            <p className="text-sm text-ink">
              {displayNameOf(request.fromUser)} × {displayNameOf(request.toUser)}
            </p>
            <p className="text-xs text-ink-faint">{relativeTimeSince(request.createdAt)}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            onClick={() => respond("approve")}
            disabled={submitting}
          >
            {submitting ? "…" : "Approve"}
          </Button>
          <Button
            variant="danger"
            className="!px-3 !py-1.5 text-xs"
            onClick={() => respond("reject")}
            disabled={submitting}
          >
            {submitting ? "…" : "Reject"}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-blossom-600">{error}</p>}
    </li>
  );
}
