"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { resizeToSquareDataUrl } from "@/lib/image-resize";

/**
 * A person's avatar on a card. Only the owner of *this* avatar ever gets
 * `canEdit` — their partner's avatar never does. When editable, hovering
 * shows a soft dark overlay with a centered pencil (a plain CSS opacity
 * transition — no separate "reveal" step to get stuck on); on touch
 * devices, where there's no hover, a single tap opens the file picker
 * directly. The whole circle is one native <button>, so there's no nested
 * click-handler indirection that could silently eat the tap. A PFP is a
 * personal change, so it applies immediately: no request, no approval.
 */
export function EditableAvatar({
  src,
  alt,
  size,
  canEdit,
  ringClass,
}: {
  src: string | null;
  alt: string;
  size: number;
  canEdit: boolean;
  ringClass?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return <Avatar src={src} alt={alt} size={size} ringClass={ringClass} />;
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

  return (
    <span className="relative z-20 inline-block pointer-events-auto" style={{ width: size, height: size }}>
      <button
        type="button"
        aria-label="Change your picture"
        disabled={busy}
        onClick={(e) => {
          // Stops this from also following the card's link underneath.
          e.preventDefault();
          e.stopPropagation();
          if (!busy) inputRef.current?.click();
        }}
        className="group block h-full w-full cursor-pointer rounded-full disabled:cursor-wait"
      >
        <Avatar src={src} alt={alt} size={size} ringClass={ringClass} />
        {/* Hover overlay: transparent → dark on hover, pencil fades in with it. */}
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors duration-200 ease-out group-hover:bg-black/45 ${
            busy ? "bg-black/45" : ""
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-[38%] w-[38%] text-white opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 ${
              busy ? "opacity-100" : ""
            }`}
          >
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      {error && (
        <p className="absolute left-1/2 top-full z-30 mt-1 w-40 -translate-x-1/2 rounded bg-white px-2 py-1 text-center text-[11px] text-blossom-600 shadow-soft">
          {error}
        </p>
      )}
    </span>
  );
}
