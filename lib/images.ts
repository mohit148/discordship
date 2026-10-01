/**
 * Server-side checks for images that arrive as data URLs (profile pictures
 * and catalog backgrounds — both are resized in the browser first, see
 * lib/image-resize.ts). SVG is deliberately not accepted: these get served
 * back from our own domain, and an SVG can carry script.
 */
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export function validateImageDataUrl(input: unknown, maxChars: number): string | null {
  if (typeof input !== "string") return null;
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(input);
  if (!match || !ALLOWED.includes(match[1])) return null;
  if (input.length > maxChars) return null;
  return input;
}

/** Decodes a stored data URL back into bytes + content type for serving. */
export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
}

export function imageResponse(dataUrl: string | null): Response {
  const decoded = dataUrl ? decodeDataUrl(dataUrl) : null;
  if (!decoded) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(decoded.bytes), {
    headers: {
      "Content-Type": decoded.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

export const MAX_AVATAR_CHARS = 400_000; // ~300KB of image
export const MAX_BACKGROUND_CHARS = 2_000_000; // ~1.5MB of image
