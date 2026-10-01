import type { DiscordUser } from "@/types";

/** The name to show for someone publicly: their Discord display name if they have one, else their username. */
export function displayNameOf(user: DiscordUser | null | undefined): string {
  if (!user) return "someone";
  return user.displayName?.trim() || user.username;
}
