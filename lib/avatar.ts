/**
 * THE one rule for which picture to show for a person — every place that turns a
 * database row (or dev-store record) into a DiscordUser goes through this, so the
 * account card, Users table, Ships, Cards, requests and the audit log can never
 * disagree.
 *
 *   1. A custom picture they uploaded (`avatar_override_url`) always wins.
 *   2. Otherwise their latest synced Discord picture (`avatar_url`).
 *   3. Otherwise nothing (the UI shows their initial).
 *
 * Storage keeps the two as separate columns on purpose: Discord syncs only ever
 * write `avatar_url`, uploads/resets only ever write `avatar_override_url`. So a
 * sync can never overwrite a custom picture, and resetting a custom picture
 * simply falls through to rule 2 with no extra bookkeeping.
 *
 * Discord avatar URLs contain the image hash, so a changed picture is a new URL
 * and no cache can serve the old one. Custom pictures carry a `?v=` stamp that
 * changes on every upload, for the same reason.
 */
export function resolveAvatarUrl(custom: string | null | undefined, discord: string | null | undefined): string | null {
  const c = custom?.trim();
  if (c) return c;
  const d = discord?.trim();
  return d || null;
}
