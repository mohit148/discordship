import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { RoleBadge } from "@/components/RoleBadge";
import { getSession } from "@/lib/session";
import { getTeamMembers } from "@/lib/data/team";
import { displayNameOf } from "@/lib/user-display";

export default async function TeamPage() {
  const session = getSession();
  const team = await getTeamMembers();

  return (
    <AppShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Team</h1>
      <p className="mt-1 text-sm text-ink-soft">
        The people who keep things running — message any of them on Discord if you need a hand.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        {team.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-ink-faint">
            Nobody's set up on the team yet.
          </p>
        ) : (
          team.map((member) => (
            <div
              key={member.user.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-white p-4 shadow-softer"
            >
              <Avatar src={member.user.avatarUrl} alt={displayNameOf(member.user)} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{displayNameOf(member.user)}</p>
                <div className="mt-1">
                  <RoleBadge role={member.role} />
                </div>
              </div>
              <a
                href={`https://discord.com/users/${member.user.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-border bg-cream-50 px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-cream-100 hover:text-ink"
              >
                Message on Discord
              </a>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
