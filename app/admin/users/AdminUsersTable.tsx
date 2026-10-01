"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { RoleBadge } from "@/components/RoleBadge";
import { SearchBar } from "@/components/SearchBar";
import type { DiscordUser } from "@/types";
import { displayNameOf } from "@/lib/user-display";

type Role = "visitor" | "ship_creator" | "admin";
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "visitor", label: "Visitor" },
  { value: "ship_creator", label: "Ship Creator" },
  { value: "admin", label: "Admin" },
];

export function AdminUsersTable({
  users,
  viewerRole,
  ownerId,
}: {
  users: DiscordUser[];
  viewerRole: "admin" | "owner";
  ownerId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roles, setRoles] = useState<Record<string, Role>>(() =>
    Object.fromEntries(users.map((u) => [u.id, (u.role as Role) ?? "visitor"]))
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => users.filter((u) => displayNameOf(u).toLowerCase().includes(query.trim().toLowerCase())),
    [users, query]
  );

  const isOwner = viewerRole === "owner";

  async function changeRole(user: DiscordUser, role: Role) {
    setPending(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}) for ${displayNameOf(user)}.`);
        return;
      }
      setRoles((prev) => ({ ...prev, [user.id]: role }));
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBar value={query} onChange={setQuery} placeholder="Search users..." />
      {error && <p className="text-xs text-blossom-600">{error}</p>}
      {!isOwner && (
        <p className="text-xs text-ink-faint">
          Only the Owner can promote or demote Admins — you can set Visitor and Ship Creator.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-faint">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Discord ID</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isOwnerRow = user.id === ownerId;
              const role = isOwnerRow ? "owner" : roles[user.id] ?? "visitor";
              // Only the Owner can touch anyone who is (or would become) an
              // Admin — matching "Owner is the only role that can
              // promote/demote Admins". Nobody edits the Owner's own row;
              // that's set purely by OWNER_DISCORD_ID.
              const canEdit = !isOwnerRow && (isOwner || role !== "admin");
              return (
                <tr key={user.id} className="table-row-hover border-b border-border last:border-0">
                  <td className="flex items-center gap-2.5 px-4 py-3">
                    <Avatar src={user.avatarUrl} alt={displayNameOf(user)} size={26} />
                    {displayNameOf(user)}
                    {user.displayName && <span className="text-xs font-normal text-ink-faint">@{user.username}</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-faint">{user.id}</td>
                  <td className="px-4 py-3">
                    {isOwnerRow ? (
                      <RoleBadge role="owner" />
                    ) : canEdit ? (
                      <select
                        value={role}
                        disabled={pending === user.id}
                        onChange={(e) => changeRole(user, e.target.value as Role)}
                        className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.filter((o) => o.value !== "admin" || isOwner).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={role} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
