import fs from "fs";
import path from "path";
import type { Ship, DiscordUser, ShipRequest, Report, AuditLogEntry } from "@/types";
import { MOCK_SHIPS, MOCK_USERS, MOCK_ADMIN_USER, MOCK_REQUESTS, MOCK_REPORTS, MOCK_AUDIT_LOG, MOCK_BACKGROUNDS } from "@/lib/mock-data";

/**
 * A tiny JSON-file "database" for local development. Supabase is the real
 * backend (see lib/supabase/ and supabase/schema.sql) — but until you've
 * connected a real project, every getX()/mutation in lib/data and app/api
 * reads and writes here instead, so clicking Approve, ending a ship, etc.
 * actually sticks around after a refresh (or even a dev server restart).
 *
 * This file (.dev-store.json, at the project root) is gitignored and
 * regenerates itself — seeded from lib/mock-data.ts — if it's ever missing.
 * Delete it any time to reset back to the sample data.
 */

/** A catalog background as stored locally, image included (as a data URL). */
export interface StoredBackground {
  id: string;
  name: string;
  imageData: string;
  createdAt: string;
}

interface DevStoreShape {
  backgrounds: StoredBackground[];
  /** Uploaded profile pictures (data URLs), keyed by Discord ID. */
  avatars: Record<string, string>;
  ships: Ship[];
  /**
   * Private "claim codes" for names-only ships, by ship ID — the Discord ID
   * each not-yet-connected participant was said to be. Deliberately kept
   * out of the Ship objects themselves (never merged in), since Ship
   * objects get passed as props into client components and would leak
   * straight into the page otherwise. Only read by lib/data/claims.ts.
   */
  claimCodes: Record<string, { a?: string; b?: string }>;

  users: DiscordUser[];
  requests: ShipRequest[];
  reports: Report[];
  auditLog: AuditLogEntry[];
}

const STORE_PATH = path.join(process.cwd(), ".dev-store.json");

function seed(): DevStoreShape {
  return {
    backgrounds: MOCK_BACKGROUNDS,
    avatars: {},
    ships: MOCK_SHIPS,
    claimCodes: {},
    users: [...MOCK_USERS, MOCK_ADMIN_USER],
    requests: MOCK_REQUESTS,
    reports: MOCK_REPORTS,
    auditLog: MOCK_AUDIT_LOG,
  };
}

function readStore(): DevStoreShape {
  try {
    if (fs.existsSync(STORE_PATH)) {
      // Older stores predate backgrounds/avatars — fill those in rather than crash.
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
      return { backgrounds: [], avatars: {}, claimCodes: {}, ...parsed };
    }
  } catch (err) {
    console.error("Local dev store was unreadable, reseeding from sample data", err);
  }
  const initial = seed();
  writeStore(initial);
  return initial;
}

function writeStore(store: DevStoreShape) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write local dev store", err);
  }
}

export const devStore = {
  /** Read the current state. */
  get(): DevStoreShape {
    return readStore();
  },
  /** Read, apply `mutator` in place, persist, and return the updated state. */
  update(mutator: (store: DevStoreShape) => void): DevStoreShape {
    const store = readStore();
    mutator(store);
    writeStore(store);
    return store;
  },
};

export function nextShipNumber(store: DevStoreShape): number {
  return store.ships.reduce((max, s) => Math.max(max, s.number), 0) + 1;
}
