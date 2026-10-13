"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ShipCard } from "@/components/ShipCard";
import { BIO_MAX_LENGTH, type BackgroundPreset, type Ship } from "@/types";

/**
 * Admin ship creation. Just type the two display names, an optional bio and
 * a background — nobody needs a Discord account connected to the site to
 * appear in a ship. The preview is the real card component.
 */
export function AdminCreateShipForm({ backgrounds }: { backgrounds: BackgroundPreset[] }) {
  const router = useRouter();
  const [personA, setPersonA] = useState("");
  const [personB, setPersonB] = useState("");
  const [personADiscordId, setPersonADiscordId] = useState("");
  const [personBDiscordId, setPersonBDiscordId] = useState("");
  const [bio, setBio] = useState("");
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const background = backgrounds.find((b) => b.id === backgroundId) ?? null;
  const person = (id: string, name: string, fallback: string) => ({
    id,
    username: name.trim() || fallback,
    displayName: name.trim() || fallback,
    avatarUrl: null,
    isPlaceholder: true,
  });
  const now = new Date().toISOString();
  const preview: Ship = {
    id: "preview",
    number: 0,
    userA: person("preview-a", personA, "Person 1"),
    userB: person("preview-b", personB, "Person 2"),
    status: "confirmed",
    isTwoAuth: false,
    customText: bio.trim() || null,
    customTextPending: null,
    customTextProposedBy: null,
    background,
    backgroundPending: null,
    backgroundProposedBy: null,
    createdAt: now,
    updatedAt: now,
    updatedBy: null,
    createdBy: null,
    endedAt: null,
  };

  const ready = personA.trim() && personB.trim() && consent && !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/ships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personAName: personA,
          personBName: personB,
          personADiscordId,
          personBDiscordId,
          bio,
          backgroundId,
          consentObtained: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      router.push(`/ships/${body.ship.id}`);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    "w-full rounded-lg border border-border bg-white p-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-lavender-400";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-5">
        <p className="text-xs text-ink-faint">
          Neither person needs a Discord account connected. Only create a ship after both people have agreed to it.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Person 1 display name</label>
            <input value={personA} onChange={(e) => setPersonA(e.target.value)} maxLength={40} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Person 2 display name</label>
            <input value={personB} onChange={(e) => setPersonB(e.target.value)} maxLength={40} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Person 1 Discord ID <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <input
              value={personADiscordId}
              onChange={(e) => setPersonADiscordId(e.target.value.trim())}
              placeholder="e.g. 123456789012345678"
              className={input}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Person 2 Discord ID <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <input
              value={personBDiscordId}
              onChange={(e) => setPersonBDiscordId(e.target.value.trim())}
              placeholder="e.g. 123456789012345678"
              className={input}
            />
          </div>
          <p className="text-xs text-ink-faint sm:col-span-2">
            Lets that person claim this ship later by logging in with Discord — never shown publicly, and each ID is
            checked against who's actually logged in, so it only works for the real account.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Bio (optional)</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
            maxLength={BIO_MAX_LENGTH}
            rows={3}
            className={`${input} resize-none`}
          />
          <p className={`mt-1 text-right text-xs ${bio.length >= BIO_MAX_LENGTH ? "text-blossom-600" : "text-ink-faint"}`}>
            {bio.length}/{BIO_MAX_LENGTH}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Background</label>
          {backgrounds.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-ink-faint">
              No backgrounds in the catalog yet — add some under Backgrounds. The default look is used until then.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {backgrounds.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBackgroundId(backgroundId === bg.id ? null : bg.id)}
                  aria-pressed={backgroundId === bg.id}
                  className={`overflow-hidden rounded-lg text-left ${
                    backgroundId === bg.id ? "ring-2 ring-lavender-500 ring-offset-2" : "hover:opacity-90"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bg.imageUrl} alt={bg.name} className="h-16 w-full object-cover" loading="lazy" />
                  <span className="block truncate bg-cream-50 px-2 py-1 text-[11px] text-ink-soft">{bg.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>I&apos;ve confirmed that both people agreed to this ship.</span>
        </label>

        {error && <p className="text-xs text-blossom-600">{error}</p>}
        <Button onClick={submit} disabled={!ready}>
          {submitting ? "Creating…" : "Create Ship"}
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">Preview</p>
        <ShipCard ship={preview} href={false} />
      </div>
    </div>
  );
}
