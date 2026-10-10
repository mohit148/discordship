"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { resizeToSquareDataUrl } from "@/lib/image-resize";

/**
 * A person's avatar on a card. Only the owner of *this* avatar ever gets
 * `canEdit` — their partner's avatar never does. When editable, hovering
 * shows a soft dark overlay with a centered pencil (a plain CSS opacity
 * transition); on touch devices, where there's no hover, a tap reveals it
 * instead. Clicking the pencil opens a small menu — reset to the Discord
 * avatar (only shown if a custom one is actually set), or upload a new
 * image — rather than jumping straight to the file picker, since "reset"
 * needs some way to be reached too. A PFP is a personal change, so both
 * actions apply immediately: no request, no approval.
 */
export function EditableAvatar({
  src,
  alt,
  size,
  canEdit,
  hasCustomAvatar,
  ringClass,
}: {
  src: string | null;
  alt: string;
  size: number;
  canEdit: boolean;
  hasCustomAvatar?: boolean;
  ringClass?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return <Avatar src={src} alt={alt} size={size} ringClass={ringClass} />;
  }

  async function save(avatarData: string | null) {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarData }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't save that picture.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that picture.");
    } finally {
      setBusy(false);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange next time.
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const avatarData = await resizeToSquareDataUrl(file);
      await save(avatarData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
      setBusy(false);
    }
  }

  return (
    <span className="relative z-20 inline-block pointer-events-auto" style={{ width: size, height: size }}>
      <button
        type="button"
        aria-label="Change your picture"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={busy}
        onClick={(e) => {
          // Stops this from also following the card's link underneath.
          e.preventDefault();
          e.stopPropagation();
          if (!busy) setMenuOpen((open) => !open);
        }}
        className="group block h-full w-full cursor-pointer rounded-full disabled:cursor-wait"
      >
        <Avatar src={src} alt={alt} size={size} ringClass={ringClass} />
        {/* Hover overlay: transparent → dark on hover, pencil fades in with it. */}
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors duration-200 ease-out group-hover:bg-black/45 ${
            busy || menuOpen ? "bg-black/45" : ""
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-[38%] w-[38%] text-white opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 ${
              busy || menuOpen ? "opacity-100" : ""
            }`}
          >
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {menuOpen && (
        <>
          {/* Click-outside catcher. */}
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
            }}
          />
          <div
            role="menu"
            className="absolute left-1/2 top-full z-40 mt-1.5 w-40 -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-white py-1 text-left shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            {hasCustomAvatar && (
              <button
                type="button"
                role="menuitem"
                onClick={() => save(null)}
                className="block w-full px-3 py-2 text-xs text-ink-soft hover:bg-cream-100 hover:text-ink"
              >
                Reset avatar
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                inputRef.current?.click();
              }}
              className="block w-full px-3 py-2 text-xs text-ink-soft hover:bg-cream-100 hover:text-ink"
            >
              Upload image
            </button>
          </div>
        </>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      {error && (
        <p className="absolute left-1/2 top-full z-30 mt-1 w-40 -translate-x-1/2 rounded bg-white px-2 py-1 text-center text-[11px] text-blossom-600 shadow-soft">
          {error}
        </p>
      )}
    </span>
  );
}
