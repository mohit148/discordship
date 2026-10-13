import type { BackgroundPreset, DiscordUser, Ship, ShipRequest, Report, AuditLogEntry } from "@/types";

// Intentionally minimal — this is only shown when Supabase has no real rows
// yet (or isn't configured), just so the UI never looks empty. See
// lib/data/*.ts for the logic that prefers real data once it exists.

function user(id: string, username: string, seed: string, displayName: string | null = null): DiscordUser {
  return {
    id,
    username,
    displayName,
    avatarUrl: `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`,
    customAvatarUrl: null,
    acceptsRequests: true,
    role: "visitor",
  };
}

/** Soft, quiet placeholder scenes so the catalog isn't empty in local dev. */
function scene(name: string, top: string, bottom: string, accent: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="600" cy="170" r="70" fill="${accent}" opacity="0.55"/><path d="M0 430 Q200 350 400 420 T800 400 V600 H0Z" fill="${accent}" opacity="0.25"/><path d="M0 500 Q250 430 500 490 T800 470 V600 H0Z" fill="${accent}" opacity="0.35"/></svg>`;
  return { id: `bg-${name.toLowerCase().replace(/\s+/g, "-")}`, name, imageData: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, createdAt: new Date().toISOString() };
}

export const MOCK_BACKGROUNDS = [
  scene("Dusk", "#5b4b8a", "#c9a7c7", "#f4d6cc"),
  scene("Meadow", "#4d7c6f", "#b9d3b0", "#f3ecc4"),
  scene("Morning", "#e7a98f", "#f6dcc3", "#fff4dc"),
];

export function mockBackgroundPreset(id: string): BackgroundPreset | null {
  const bg = MOCK_BACKGROUNDS.find((b) => b.id === id);
  return bg ? { id: bg.id, name: bg.name, imageUrl: `/api/backgrounds/${bg.id}/image`, createdAt: bg.createdAt } : null;
}

export const people = [
  user("1", "user_a", "a-cozy", "Alex"),
  user("2", "user_b", "b-cozy", "Bao"),
  user("9", "user_i", "i-cozy", "Ivy"),
  user("10", "user_j", "j-cozy", null),
];

export const MOCK_USERS = people;

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const MOCK_SHIPS: Ship[] = [
  {
    id: "133",
    number: 133,
    userA: people[0],
    userB: people[1],
    status: "confirmed",
    isTwoAuth: true,
    customText: "just some friends :)",
    customTextPending: null,
    customTextProposedBy: null,
    background: mockBackgroundPreset("bg-dusk"),
    backgroundPending: null,
    backgroundProposedBy: null,
    createdAt: daysAgoIso(64),
    updatedAt: daysAgoIso(2),
    updatedBy: people[0],
    createdBy: null,
    endedAt: null,
  },
  {
    id: "129",
    number: 129,
    userA: people[2],
    userB: people[3],
    status: "pending",
    isTwoAuth: false,
    customText: null,
    customTextPending: null,
    customTextProposedBy: null,
    background: null,
    backgroundPending: null,
    backgroundProposedBy: null,
    createdAt: daysAgoIso(3),
    updatedAt: daysAgoIso(3),
    updatedBy: null,
    createdBy: null,
    endedAt: null,
  },
];

export const MOCK_REQUESTS: ShipRequest[] = [
  {
    id: "r1",
    fromUser: people[1],
    toUser: people[2],
    status: "pending",
    createdAt: daysAgoIso(2),
    respondedAt: null,
  },
];

export const MOCK_REPORTS: Report[] = [
  {
    id: "rep1",
    shipId: "133",
    reportedUser: null,
    reportedBy: people[3],
    reason: "Sample report — just an example of what one looks like.",
    status: "open",
    createdAt: daysAgoIso(1),
  },
];

export const MOCK_ADMIN_USER: DiscordUser = {
  id: "999",
  username: "mod_admin",
  displayName: "Mod",
  avatarUrl: `https://api.dicebear.com/7.x/thumbs/svg?seed=admin-cozy`,
  customAvatarUrl: null,
  isAdmin: true,
  role: "admin",
};

export const MOCK_AUDIT_LOG: AuditLogEntry[] = [
  {
    id: "a1",
    actor: MOCK_ADMIN_USER,
    action: "created admin ship",
    targetType: "ship",
    targetId: "129",
    detail: "#129 created, awaiting confirmation from both people",
    createdAt: daysAgoIso(3),
  },
];
