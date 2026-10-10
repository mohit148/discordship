import Image from "next/image";

export function Avatar({
  src,
  alt,
  size = 32,
  ringClass = "ring-1 ring-border",
}: {
  src: string | null;
  alt: string;
  size?: number;
  ringClass?: string;
}) {
  // Uploaded pictures come from our own /api/avatars route (already small),
  // so they skip the image optimizer.
  const unoptimized = !!src && (src.startsWith("/api/") || src.startsWith("data:"));
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-cream-200 ${ringClass}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" unoptimized={unoptimized} />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-ink-faint"
          style={{ fontSize: Math.max(11, size * 0.4) }}
        >
          {alt.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

export function AvatarPair({
  a,
  b,
  size = 56,
}: {
  a: { avatarUrl: string | null; username: string; displayName?: string | null };
  b: { avatarUrl: string | null; username: string; displayName?: string | null };
  size?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <Avatar src={a.avatarUrl} alt={a.displayName || a.username} size={size} />
      <span className="text-ink-faint">×</span>
      <Avatar src={b.avatarUrl} alt={b.displayName || b.username} size={size} />
    </div>
  );
}
