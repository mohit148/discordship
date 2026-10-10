"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

export function ClaimButton({ shipId }: { shipId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ships/${shipId}/claim`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      router.push(`/ships/${shipId}`);
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={claim} disabled={submitting}>
        {submitting ? "Claiming…" : "Claim this ship"}
      </Button>
      {error && <p className="text-xs text-blossom-600">{error}</p>}
    </div>
  );
}
