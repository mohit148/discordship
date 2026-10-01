import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { MOCK_ADMIN_USER } from "@/lib/mock-data";

const COOKIE_NAME = "ship_session";

interface SessionPayload {
  discordId: string;
  username: string;
  displayName?: string | null;
  avatarUrl: string | null;
  // Convenience only — for what to *show* (e.g. an "Admin Portal" nav
  // link). Never trusted for authorization; every admin-gated page and API
  // route re-checks the real role live via lib/roles.ts instead, since this
  // is just a snapshot from whenever the cookie was issued.
  isAdmin: boolean;
  issuedAt: number;
}

function sign(value: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET!).update(value).digest("hex");
}

export function createSessionCookieValue(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function verify(cookieValue: string): SessionPayload | null {
  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Read the current session in a Server Component or Route Handler. */
export function getSession(): SessionPayload | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (raw) {
    const verified = verify(raw);
    if (verified) return verified;
  }

  // TEMPORARY: lets you preview /admin locally before Discord OAuth is set
  // up. Remove this block (or delete DEV_FAKE_ADMIN from .env.local) before
  // deploying anywhere real. isAdmin here is just the display snapshot
  // (see the field's comment above) — actual access still goes through
  // lib/roles.ts, which is why DEV_FAKE_ADMIN also needs a matching
  // OWNER_DISCORD_ID or ADMIN_DISCORD_IDS entry (or a "role":"admin" row in
  // the dev store) to actually reach the Admin Portal, not just this cookie.
  if (process.env.DEV_FAKE_ADMIN === "true") {
    return {
      discordId: MOCK_ADMIN_USER.id,
      username: MOCK_ADMIN_USER.username,
      displayName: MOCK_ADMIN_USER.displayName,
      avatarUrl: MOCK_ADMIN_USER.avatarUrl,
      isAdmin: true,
      issuedAt: Date.now(),
    };
  }

  return null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export type { SessionPayload };
