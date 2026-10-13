"use client";

import { useState } from "react";

export function ReportRowActions({ reportId }: { reportId: string }) {
  const [resolved, setResolved] = useState<"resolved" | "dismissed" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: "resolved" | "dismissed") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
        return;
      }

      setResolved(status);
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (resolved) {
    return <span className="text-xs text-ink-faint">{resolved === "resolved" ? "Resolved" : "Dismissed"}</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex shrink-0 gap-2 text-xs font-medium">
        <button className="text-sage-500 hover:underline disabled:opacity-50" disabled={submitting} onClick={() => respond("resolved")}>
          Resolve
        </button>
        <button className="text-ink-faint hover:underline disabled:opacity-50" disabled={submitting} onClick={() => respond("dismissed")}>
          Dismiss
        </button>
      </div>
      {error && <p className="text-xs text-blossom-600">{error}</p>}
    </div>
  );
}
