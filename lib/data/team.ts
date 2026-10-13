import { getUsers } from "./users";
import { isOwnerId, type Role } from "@/lib/roles";
import type { DiscordUser } from "@/types";

export interface TeamMember {
  user: DiscordUser;
  role: Role;
}

const ROLE_ORDER: Record<Role, number> = { owner: 0, admin: 1, ship_creator: 2, visitor: 3 };

/**
 * Everyone with an actual team role: the Owner (recognized by
 * OWNER_DISCORD_ID, even if they've never logged in and so have no user
 * row), plus anyone whose stored role is "admin" or "ship_creator". Plain
 * Visitors never show up here.
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const users = await getUsers();
  const members: TeamMember[] = [];

  for (const user of users) {
    if (isOwnerId(user.id)) {
      members.push({ user, role: "owner" });
    } else if (user.role === "admin" || user.role === "ship_creator") {
      members.push({ user, role: user.role });
    }
  }

  const ownerId = process.env.OWNER_DISCORD_ID;
  if (ownerId && !members.some((m) => m.user.id === ownerId)) {
    // The Owner hasn't logged in yet (no user row) — still show them.
    members.unshift({
      user: { id: ownerId, username: "Owner", displayName: null, avatarUrl: null },
      role: "owner",
    });
  }

  return members.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}
