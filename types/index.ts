export type ShipStatus = "confirmed" | "pending" | "ended" | "archived";

export interface DiscordUser {
  id: string; // Discord user ID — the stable identifier we key everything on
  username: string;
  displayName: string | null;
  avatarUrl: string | null; // effective avatar to show — custom override if set, else the synced Discord avatar
  /** The raw override value, if this person set a custom PFP. Null means "using their Discord avatar." */
  customAvatarUrl?: string | null;
  isAdmin?: boolean;
  /** Their stored role — "visitor" if never set. Owner is never stored; see lib/roles.ts. */
  role?: "visitor" | "ship_creator" | "admin";
  /** True for someone who only exists as a name on an admin-created ship (no Discord account connected). */
  isPlaceholder?: boolean;
  /** Whether this person currently accepts incoming ship requests. Defaults to true. */
  acceptsRequests?: boolean;
}

/** A card background from the admin-managed catalog. */
export interface BackgroundPreset {
  id: string;
  name: string;
  imageUrl: string; // served by /api/backgrounds/<id>/image
  createdAt: string;
}

export const BIO_MAX_LENGTH = 300;

export interface Ship {
  id: string;
  number: number;
  userA: DiscordUser;
  userB: DiscordUser;
  status: ShipStatus;
  isTwoAuth: boolean; // true if created via the OAuth request flow, false if admin-created
  customText: string | null;
  /** A proposed bio change waiting on the other participant's confirmation. */
  customTextPending: string | null;
  customTextProposedBy: DiscordUser | null;
  /** The card's background, from the catalog. Null means the default look. */
  background: BackgroundPreset | null;
  /** A proposed background change waiting on the other participant's confirmation. */
  backgroundPending: BackgroundPreset | null;
  backgroundProposedBy: DiscordUser | null;
  createdAt: string; // ISO date — "shipped since"
  updatedAt: string;
  updatedBy: DiscordUser | null;
  /** Who manually created this (a names-only ship an admin or Ship Creator made). Null for ships from the request flow. */
  createdBy: DiscordUser | null;
  endedAt: string | null;
}

export type ShipRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface ShipRequest {
  id: string;
  fromUser: DiscordUser;
  toUser: DiscordUser;
  status: ShipRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}

/**
 * A shared-card change (bio or background) proposed by one participant and waiting
 * on the other's confirmation — surfaced on the unified Requests page
 * alongside ship requests. Not its own database table: derived from the
 * pending/proposed_by columns already on `ships` (see lib/data/ships.ts),
 * the same way both fields already work on the ship detail page.
 */
export interface CardChangeRequest {
  id: string; // `${ship.id}:${field}`
  ship: Ship;
  field: "bio" | "background";
  proposedBy: DiscordUser;
  /** The proposed bio text (for field "bio"). */
  proposedValue: string;
  currentValue: string | null;
  /** For field "background": what's being proposed and what's there now. */
  proposedBackground: BackgroundPreset | null;
  currentBackground: BackgroundPreset | null;
}

export type ReportTargetType = "ship" | "user";

export interface Report {
  id: string;
  shipId: string | null;
  reportedUser: DiscordUser | null;
  reportedBy: DiscordUser;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actor: DiscordUser | null;
  action: string;
  targetType: "ship" | "user" | "request" | "report" | "settings" | "background";
  targetId: string | null;
  detail: string | null;
  createdAt: string;
}

export interface CommunityStats {
  totalShips: number;
  totalPeople: number;
  activeShips: number;
  archivedShips: number;
  newShipsThisMonth: number;
  longestRunningShip: { ship: Ship; durationLabel: string } | null;
}
