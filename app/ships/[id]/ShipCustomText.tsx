"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { BIO_MAX_LENGTH } from "@/types";
import { quoteBio } from "@/lib/text-format";

/**
 * The ship's bio. On a normal ship, saving *proposes* the change and the
 * other person approves it from their Requests tab (mode "propose"). On an
 * admin-created ship there's no one with an account to approve anything, so
 * an admin's edit applies directly (mode "direct").
 */
export function ShipCustomText({
  shipId,
  initialText,
  canEdit,
  mode = "propose",
  notice,
}: {
  shipId: string;
  initialText: string | null;
  canEdit: boolean;
  mode?: "propose" | "direct";
  notice?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialText ?? "");
  const [saved, setSaved] = useState(initialText);
  const [flash, setFlash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ships/${shipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customText: text }),
      });
      if (res.ok) {
        if (mode === "direct") {
          setSaved(text);
        } else {
          // Not applied yet — it's waiting on the other person.
          setFlash("Sent — it'll show up once the other person approves it.");
        }
        setEditing(false);
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}). Check the server console for details.`);
      }
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Bio</h2>
        {canEdit && !editing && (
          <button
            onClick={() => {
              setFlash(null);
              setEditing(true);
            }}
            className="text-ink-faint hover:text-ink-soft"
            aria-label="Edit bio"
          >
            ✎
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, BIO_MAX_LENGTH))}
            maxLength={BIO_MAX_LENGTH}
            rows={4}
            placeholder="just some friends :)"
            className="w-full resize-none rounded-lg border border-border bg-white p-3 text-sm text-ink placeholder:text-ink-faint focus:border-lavender-400"
          />
          <div className="flex items-start justify-between gap-3 text-xs text-ink-faint">
            <span>
              {mode === "direct"
                ? "Your edit applies right away — this ship isn't on the mutual-approval system."
                : "The other person will need to approve this before it shows on the card."}
            </span>
            <span className={text.length >= BIO_MAX_LENGTH ? "text-blossom-600" : ""}>
              {text.length}/{BIO_MAX_LENGTH}
            </span>
          </div>
          {error && <p className="text-xs text-blossom-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setText(saved ?? "");
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? "Saving…" : mode === "direct" ? "Save" : "Propose change"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-cream-50 px-4 py-3 text-sm text-ink-soft [overflow-wrap:anywhere] whitespace-pre-line">
            {quoteBio(saved) || <span className="text-ink-faint">No bio yet.</span>}
          </div>
          {(flash || notice) && <p className="mt-1.5 text-xs text-ink-faint">{flash || notice}</p>}
        </>
      )}
    </div>
  );
}
