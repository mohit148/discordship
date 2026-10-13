"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { displayNameOf } from "@/lib/user-display";
import type { CardChangeRequest } from "@/types";

export function CardChangeRequestRow({ request }: { request: CardChangeRequest }) {
  const [resolved, setResolved] = useState<"accepted" | "declined" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function respond(action: "accept" | "decline") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ships/${request.ship.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: request.field, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      setResolved(action === "accept" ? "accepted" : "declined");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldLabel = request.field === "bio" ? "bio" : "background";

  if (resolved) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2.5 opacity-60">
        <p className="text-sm text-ink">
          {fieldLabel} change for {displayNameOf(request.ship.userA)} × {displayNameOf(request.ship.userB)}
        </p>
        <span className="text-xs text-ink-faint">{resolved === "accepted" ? "Accepted" : "Declined"}</span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-white px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar src={request.proposedBy.avatarUrl} alt={displayNameOf(request.proposedBy)} size={28} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            <Link href={`/ships/${request.ship.id}`} className="font-medium hover:underline">
              {displayNameOf(request.ship.userA)} × {displayNameOf(request.ship.userB)}
            </Link>{" "}
            — {displayNameOf(request.proposedBy)} wants to change the {fieldLabel}
          </p>
        </div>
      </div>

      {request.field === "bio" ? (
        <div className="rounded-md bg-cream-50 px-3 py-2 text-xs text-ink-soft [overflow-wrap:anywhere]">
          {request.currentValue && <p className="text-ink-faint line-through">{request.currentValue}</p>}
          <p className="text-ink">{request.proposedValue}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-md bg-cream-50 px-3 py-2 text-xs text-ink-soft">
          <BackgroundThumb bg={request.currentBackground} label="Now" />
          <span className="text-ink-faint">→</span>
          <BackgroundThumb bg={request.proposedBackground} label="Proposed" highlight />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => respond("accept")} disabled={submitting}>
          {submitting ? "…" : "Accept"}
        </Button>
        <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => respond("decline")} disabled={submitting}>
          {submitting ? "…" : "Decline"}
        </Button>
      </div>
      {error && <p className="text-xs text-blossom-600">{error}</p>}
    </li>
  );
}

function BackgroundThumb({
  bg,
  label,
  highlight = false,
}: {
  bg: CardChangeRequest["proposedBackground"];
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div
        className={`h-14 overflow-hidden rounded-md border ${highlight ? "border-lavender-400" : "border-border"} ${
          bg ? "" : "bg-gradient-to-br from-lavender-400 to-blossom-400"
        }`}
      >
        {bg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg.imageUrl} alt={bg.name} className="h-full w-full object-cover" />
        )}
      </div>
      <p className="mt-1 truncate text-[11px] text-ink-faint">
        {label}: <span className="text-ink-soft">{bg?.name ?? "Default"}</span>
      </p>
    </div>
  );
}
