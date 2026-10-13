"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { resizeToBackgroundDataUrl } from "@/lib/image-resize";
import type { BackgroundPreset } from "@/types";

export function AdminBackgroundsManager({ initialBackgrounds }: { initialBackgrounds: BackgroundPreset[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [backgrounds, setBackgrounds] = useState(initialBackgrounds);
  const [name, setName] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<BackgroundPreset | null>(null);
  const [removing, setRemoving] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setImageData(await resizeToBackgroundDataUrl(file));
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, "").slice(0, 40));
    } catch (err) {
      setImageData(null);
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    }
  }

  async function add() {
    if (!imageData || !name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backgrounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), imageData }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      setBackgrounds((prev) => [...prev, body.background]);
      setName("");
      setImageData(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setAdding(false);
    }
  }

  async function remove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/backgrounds/${removeTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      setBackgrounds((prev) => prev.filter((b) => b.id !== removeTarget.id));
      setRemoveTarget(null);
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Add a background</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-cream-50 sm:w-44">
            {imageData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageData} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-ink-faint hover:text-ink-soft">
                Choose an image…
              </button>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Name (e.g. Quiet Dusk)"
              className="w-full rounded-lg border border-border bg-white p-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-lavender-400"
            />
            <p className="text-xs text-ink-faint">
              Landscape images work best. It&apos;s resized automatically, and the card fades to a darker tone at the bottom, so
              busy or very bright images are fine.
            </p>
            {error && <p className="text-xs text-blossom-600">{error}</p>}
            <div className="flex gap-2">
              {imageData && (
                <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                  Change image
                </Button>
              )}
              <Button onClick={add} disabled={!imageData || !name.trim() || adding}>
                {adding ? "Adding…" : "Add to catalog"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">In the catalog ({backgrounds.length})</h2>
        {backgrounds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-ink-faint">
            Nothing here yet — cards use the default look until you add a background.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {backgrounds.map((bg) => (
              <div key={bg.id} className="overflow-hidden rounded-lg border border-border bg-white">
                <div className="h-28 bg-cream-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bg.imageUrl} alt={bg.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-ink">{bg.name}</span>
                  <button onClick={() => setRemoveTarget(bg)} className="shrink-0 text-xs font-medium text-blossom-600 hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title={`Remove “${removeTarget?.name ?? ""}”?`}
        description="It leaves the catalog right away. Any card using it falls back to the default look."
        confirmLabel={removing ? "Removing…" : "Remove"}
        variant="danger"
        onConfirm={remove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
