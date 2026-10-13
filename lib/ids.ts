const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DISCORD_ID_RE = /^[0-9]{5,25}$/;

/** True for a canonical UUID. Used before any id goes into a database filter. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** True for something shaped like a Discord snowflake. */
export function isDiscordId(value: unknown): value is string {
  return typeof value === "string" && DISCORD_ID_RE.test(value);
}
