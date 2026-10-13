"use client";

import { useState } from "react";

export function RequestSettingsToggle({ initialValue }: { initialValue: boolean }) {
  const [enabled, setEnabled] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setSubmitting(true);
    setError(null);
    // Optimistic: this is a low-stakes preference toggle, not a destructive action.
    setEnabled(next);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptsRequests: next }),
      });
      if (!res.ok) {
        setEnabled(!next);
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't save that — try again.");
      }
    } catch {
      setEnabled(!next);
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-4">
      <div>
        <p className="text-sm font-medium text-ink">Accept ship requests</p>
        <p className="text-xs text-ink-faint">
          {enabled ? "Anyone can send you a ship request." : "You won't receive any new ship requests."}
        </p>
        {error && <p className="mt-1 text-xs text-blossom-600">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={submitting}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-lavender-500" : "bg-cream-200"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-softer transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
