import Link from "next/link";
import { EditableAvatar } from "./EditableAvatar";
import { StatusBadge } from "./StatusBadge";
import { durationSince } from "@/lib/dates";
import { displayNameOf } from "@/lib/user-display";
import { quoteBio } from "@/lib/text-format";
import type { Ship } from "@/types";

type CardSize = "compact" | "default" | "full";

const SIZES: Record<
  CardSize,
  { box: string; pad: string; avatar: number; names: string; bio: string; gap: string }
> = {
  // Small previews — the background picker, admin preview.
  compact: {
    box: "min-h-[9.5rem] rounded-xl",
    pad: "p-2.5",
    avatar: 30,
    names: "text-xs",
    bio: "line-clamp-1 text-[11px]",
    gap: "gap-1",
  },
  // Grid cards on the Cards page.
  default: {
    box: "min-h-[19rem] rounded-2xl",
    pad: "p-4",
    avatar: 56,
    names: "text-base",
    bio: "line-clamp-3 text-sm",
    gap: "gap-2",
  },
  // The hero card at the top of a ship's own page — shows the whole bio.
  full: {
    box: "min-h-[24rem] rounded-2xl",
    pad: "p-6",
    avatar: 88,
    names: "text-xl",
    bio: "whitespace-pre-line text-base",
    gap: "gap-3",
  },
};

// A soft plum-tinted fade rather than flat black: clear at the top so the
// background shows, deepening toward the bottom where the text sits.
const FADE = "bg-gradient-to-t from-[#241d33]/85 via-[#241d33]/40 to-[#241d33]/5";

/**
 * A ship as a card. Its background comes from the admin-managed catalog
 * (or a quiet default gradient if none is set), with a gradient fade so the
 * text stays readable on any image.
 *
 * `href`: whether the card links to the ship page (grid cards do, the hero
 * on the ship page itself doesn't). `viewerId`: if given, the viewer's own
 * avatar (and only theirs) gets the hover pencil for changing their PFP.
 * `canEdit`: shows "Edit Card", which goes to the ship page where the
 * approval-based bio/background editing lives (see ShipCustomText.tsx and
 * ShipBackgroundPicker.tsx) — this component doesn't duplicate that.
 */
export function ShipCard({
  ship,
  size = "default",
  href = true,
  canEdit = false,
  viewerId,
  displayNumber,
}: {
  ship: Ship;
  size?: CardSize;
  href?: boolean;
  canEdit?: boolean;
  viewerId?: string | null;
  /** This ship's position in whatever list is currently shown (not a permanent ID) — omit to show no number, e.g. on the ship's own page. */
  displayNumber?: number;
}) {
  const s = SIZES[size];
  const duration = durationSince(ship.createdAt, ship.status === "ended" ? ship.endedAt : null);
  const hasPendingChange = !!ship.customTextPending || !!ship.backgroundPending;
  const quotedBio = quoteBio(ship.customText);
  const ownsA = !!viewerId && !ship.userA.isPlaceholder && ship.userA.id === viewerId;
  const ownsB = !!viewerId && !ship.userB.isPlaceholder && ship.userB.id === viewerId;
  const compact = size === "compact";

  return (
    <div className={`relative isolate flex flex-col overflow-hidden border border-border shadow-softer ${s.box}`}>
      {/* Background */}
      {ship.background ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ship.background.imageUrl}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-lavender-400 to-blossom-400" />
      )}
      <div className={`absolute inset-0 -z-10 ${FADE}`} />

      {href && (
        <Link href={`/ships/${ship.id}`} aria-label={`${displayNameOf(ship.userA)} and ${displayNameOf(ship.userB)}`} className="absolute inset-0 z-0" />
      )}

      {/* pointer-events-none lets clicks fall through to the link above;
          the few interactive bits opt back in. */}
      <div className={`pointer-events-none relative z-10 flex flex-1 flex-col ${s.pad}`}>
        <div className="flex items-start justify-between gap-2">
          <StatusBadge status={ship.status} />
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
            {duration.label}
          </span>
        </div>

        <div className={`flex flex-1 items-center justify-center ${compact ? "py-1" : "py-3"}`}>
          <div className="flex items-center gap-3">
            <EditableAvatar
              src={ship.userA.avatarUrl}
              alt={displayNameOf(ship.userA)}
              size={s.avatar}
              canEdit={ownsA}
              hasCustomAvatar={!!ship.userA.customAvatarUrl}
              ringClass="ring-2 ring-white/80"
            />
            <span className="text-white/70">×</span>
            <EditableAvatar
              src={ship.userB.avatarUrl}
              alt={displayNameOf(ship.userB)}
              size={s.avatar}
              canEdit={ownsB}
              hasCustomAvatar={!!ship.userB.customAvatarUrl}
              ringClass="ring-2 ring-white/80"
            />
          </div>
        </div>

        <div className={`flex flex-col text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.35)] ${s.gap}`}>
          <p className={`flex items-baseline justify-center gap-1.5 text-center font-semibold ${s.names}`}>
            <span className="min-w-0 max-w-[45%] truncate">{displayNameOf(ship.userA)}</span>
            <span className="text-white/70">×</span>
            <span className="min-w-0 max-w-[45%] truncate">{displayNameOf(ship.userB)}</span>
          </p>

          {quotedBio && (
            <p className={`text-center text-white/90 [overflow-wrap:anywhere] ${s.bio}`}>{quotedBio}</p>
          )}

          {!compact && (
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/75">
              <span>{displayNumber !== undefined ? `#${displayNumber}` : ""}</span>
              <div className="flex items-center gap-1.5">
                {canEdit && hasPendingChange && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-500 [text-shadow:none]">
                    Pending
                  </span>
                )}
                {canEdit && href && (
                  <Link
                    href={`/ships/${ship.id}`}
                    className="pointer-events-auto rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink [text-shadow:none] hover:bg-white"
                  >
                    Edit Card
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
