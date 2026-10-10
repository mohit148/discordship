"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { displayNameOf } from "@/lib/user-display";
import type { DiscordUser } from "@/types";

/**
 * Lets whoever manages a manual (no-account) ship rename a side that
 * hasn't been claimed yet, and lets an admin also edit that side's private
 * claim code (the Discord ID that lets them later claim it). Once a side
 * connects a real Discord account, their name and identity come from
 * Discord from then on — none of this applies anymore for that side.
 */
export function ShipParticipantNames({
  shipId,
  userA,
  userB,
  isAdmin,
  claimCodeA,
  claimCodeB,
}: {
  shipId: string;
  userA: DiscordUser;
  userB: DiscordUser;
  isAdmin: boolean;
  claimCodeA: string | null;
  claimCodeB: string | null;
}) {
  return (
    <div className="mt-5">
      <h2 className="mb-1.5 text-sm font-semibold text-ink">Names{isAdmin ? " & claim codes" : ""}</h2>
      <div className="flex flex-col gap-2">
        <NameRow shipId={shipId} side="a" user={userA} isAdmin={isAdmin} claimCode={claimCodeA} />
        <NameRow shipId={shipId} side="b" user={userB} isAdmin={isAdmin} claimCode={claimCodeB} />
      </div>
      {isAdmin && (
        <p className="mt-1.5 text-xs text-ink-faint">
          The Discord ID is private — it's only used to confirm this person is really them when they log in to claim
          this ship. Never shown publicly.
        </p>
      )}
    </div>
  );
}

function NameRow({
  shipId,
  side,
  user,
  isAdmin,
  claimCode,
}: {
  shipId: string;
  side: "a" | "b";
  user: DiscordUser;
  isAdmin: boolean;
  claimCode: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayNameOf(user));
  const [discordId, setDiscordId] = useState(claimCode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user.isPlaceholder) {
    // Already claimed — their name and identity sync live from Discord, not editable here.
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-cream-50 px-4 py-2.5 text-sm">
        <span className="text-ink">{displayNameOf(user)}</span>
        <span className="text-xs text-ink-faint">Connected to Discord</span>
      </div>
    );
  }

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      payload[side === "a" ? "personAName" : "personBName"] = name;
      if (isAdmin) {
        payload[side === "a" ? "personADiscordId" : "personBDiscordId"] = discordId.trim();
      }
      const res = await fetch(`/api/ships/${shipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        setError(resBody.error || `Failed (${res.status}).`);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-white px-4 py-2.5">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-ink-faint">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full rounded-lg border border-border bg-white p-2 text-sm text-ink focus:border-lavender-400"
          />
        </div>
        {isAdmin && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-ink-faint">Discord ID (private)</label>
            <input
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value.trim())}
              placeholder="e.g. 123456789012345678"
              className="w-full rounded-lg border border-border bg-white p-2 text-sm text-ink placeholder:text-ink-faint focus:border-lavender-400"
            />
          </div>
        )}
        {error && <p className="text-xs text-blossom-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setName(displayNameOf(user));
              setDiscordId(claimCode ?? "");
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={submitting || !name.trim()}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-cream-50 px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <span className="text-ink">{displayNameOf(user)}</span>
        {isAdmin && (
          <p className="truncate text-[11px] text-ink-faint">{claimCode ? `Claim code: ${claimCode}` : "No claim code set"}</p>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="shrink-0 text-ink-faint hover:text-ink-soft"
        aria-label={`Edit ${displayNameOf(user)}`}
      >
        ✎
      </button>
    </div>
  );
}
