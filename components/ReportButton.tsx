"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { displayNameOf } from "@/lib/user-display";
import type { DiscordUser } from "@/types";

/**
 * Lets a signed-in person report this ship/card, or one specific person in
 * it. Posts to /api/reports (service-role write; admin panel already has
 * the review UI at /admin/reports — this is just the missing "file one"
 * side of that).
 */
export function ReportButton({ shipId, participants }: { shipId: string; participants: DiscordUser[] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("ship");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (reason.trim().length < 3) {
      setError("Tell us a bit more about what's going on.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipId: target === "ship" ? shipId : null,
          reportedUserId: target === "ship" ? null : target,
          reason: reason.trim(),
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
      }
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setTimeout(() => {
      setDone(false);
      setReason("");
      setTarget("ship");
      setError(null);
    }, 200);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-ink-faint underline decoration-dotted hover:text-ink-soft"
      >
        Report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-white p-5 shadow-soft">
            {done ? (
              <>
                <h2 className="text-sm font-semibold text-ink">Thanks — an admin will take a look.</h2>
                <div className="mt-4 flex justify-end">
                  <Button onClick={close}>Close</Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-ink">Report</h2>
                <p className="mt-1 text-xs text-ink-faint">This goes straight to the admin team.</p>

                <label className="mt-3 block text-xs font-medium text-ink-soft">What are you reporting?</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-white p-2 text-sm text-ink"
                >
                  <option value="ship">This ship / card</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayNameOf(p)}
                    </option>
                  ))}
                </select>

                <label className="mt-3 block text-xs font-medium text-ink-soft">What's going on?</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="mt-1 w-full resize-none rounded-lg border border-border bg-white p-2 text-sm text-ink placeholder:text-ink-faint focus:border-lavender-400"
                  placeholder="A short description helps admins act on this faster."
                />
                {error && <p className="mt-1 text-xs text-blossom-600">{error}</p>}

                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={submit} disabled={submitting}>
                    {submitting ? "Sending…" : "Submit report"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
