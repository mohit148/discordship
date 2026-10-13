import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { AvatarPair } from "@/components/Avatar";
import { getSession } from "@/lib/session";
import { getShips } from "@/lib/data/ships";
import { getUsers } from "@/lib/data/users";
import { getReports } from "@/lib/data/reports";
import { getAuditLog } from "@/lib/data/audit";
import { getAuthHealth } from "@/lib/data/oauth-tokens";
import { getOAuthConfig } from "@/lib/oauth-config";
import { Avatar } from "@/components/Avatar";
import { relativeTimeSince } from "@/lib/dates";
import { displayNameOf } from "@/lib/user-display";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function AdminDashboardPage() {
  const session = getSession()!;
  const [ships, users, reports, audit, health] = await Promise.all([
    getShips(),
    getUsers(),
    getReports(),
    getAuditLog(),
    getAuthHealth().catch(() => null),
  ]);
  const now = Date.now();
  const since = (iso: string | null | undefined, days: number) => !!iso && now - new Date(iso).getTime() < days * DAY;

  // ---- ships
  const current = ships.filter((s) => s.status === "confirmed");
  const ended = ships.filter((s) => s.status === "ended");
  const archived = ships.filter((s) => s.status === "archived");
  const live = ships.filter((s) => s.status !== "archived");
  const namesOnly = live.filter((s) => s.userA.isPlaceholder || s.userB.isPlaceholder).length;
  const withBio = live.filter((s) => !!s.customText).length;
  const withBackground = live.filter((s) => !!s.background).length;
  const pendingChanges = live.filter((s) => s.customTextPending || s.backgroundPending);
  const newShips7 = ships.filter((s) => since(s.createdAt, 7)).length;
  const newShips30 = ships.filter((s) => since(s.createdAt, 30)).length;

  // ---- users
  const roleCount = (r: string) => users.filter((u) => (u.role ?? "visitor") === r).length;
  const newUsers7 = users.filter((u) => since(u.createdAt, 7)).length;
  const inShip = new Set(live.flatMap((s) => [s.userA.id, s.userB.id]));
  const withoutShip = users.filter((u) => !inShip.has(u.id)).length;

  // ---- reports
  const openReports = reports.filter((r) => r.status === "open");

  // ---- ships created per week, last 8 weeks (oldest → newest)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const label = new Date(start + 1).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { label, count: ships.filter((s) => { const t = new Date(s.createdAt).getTime(); return t > start && t <= end; }).length };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));

  const dryRun = getOAuthConfig().dryRun;
  const attention = openReports.length + pendingChanges.length + (health ? health.suspected + health.confirmed : 0);

  return (
    <AdminShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">A quick look at how things are going.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Current ships" value={current.length} sub={`${newShips7} new this week`} accent="lavender" />
        <Metric label="Ended ships" value={ended.length} sub={`${archived.length} archived`} accent="sky" />
        <Metric label="People" value={users.length} sub={`${newUsers7} new this week`} accent="sage" />
        <Metric label="Open reports" value={openReports.length} sub={openReports.length ? "need a look" : "all clear"} accent="blossom" href="/admin/reports" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* needs attention */}
        <Panel title="Needs attention" className="lg:col-span-1">
          {attention === 0 ? (
            <p className="text-sm text-ink-faint">Nothing needs you right now ♡</p>
          ) : (
            <ul className="-mx-2 flex flex-col gap-1 text-sm">
              {openReports.length > 0 && (
                <Row href="/admin/reports" label="Open reports" value={openReports.length} tone="blossom" />
              )}
              {pendingChanges.length > 0 && (
                <Row href="/admin/ships" label="Card changes waiting on a partner" value={pendingChanges.length} tone="amber" />
              )}
              {health && health.suspected > 0 && (
                <Row href="/admin/users" label="Possibly removed the app on Discord" value={health.suspected} tone="amber" />
              )}
              {health && health.confirmed > 0 && (
                <Row href="/admin/users" label="Confirmed removed the app" value={health.confirmed} tone="blossom" />
              )}
            </ul>
          )}
        </Panel>

        {/* ships per week */}
        <Panel title="New ships per week" className="lg:col-span-2" note={`${newShips30} in the last 30 days`}>
          <div className="flex h-32 items-end gap-2">
            {weeks.map((w) => (
              <div key={w.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[11px] text-ink-faint">{w.count}</span>
                <div
                  className="w-full rounded-t bg-lavender-200"
                  style={{ height: `${Math.max(4, (w.count / maxWeek) * 80)}%` }}
                  title={`${w.count} ship(s) — week of ${w.label}`}
                />
                <span className="truncate text-[10px] text-ink-faint">{w.label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Ships">
          <Stat label="Two-person confirmed (both agreed)" value={live.filter((s) => s.isTwoAuth).length} />
          <Stat label="Added by hand (admin / creator)" value={live.filter((s) => !s.isTwoAuth).length} />
          <Stat label="With a name only (not logged in yet)" value={namesOnly} />
          <Stat label="Have a bio" value={pct(withBio, live.length)} />
          <Stat label="Have a custom background" value={pct(withBackground, live.length)} />
        </Panel>

        <Panel title="People">
          <Stat label="Visitors" value={roleCount("visitor")} />
          <Stat label="Ship creators" value={roleCount("ship_creator")} />
          <Stat label="Admins" value={roleCount("admin")} />
          <Stat label="Not in any ship" value={withoutShip} />
          <Stat label="New in the last 30 days" value={users.filter((u) => since(u.createdAt, 30)).length} />
        </Panel>

        <Panel title="Discord access checks" note={dryRun ? "Dry run — nothing is deleted" : "Live — removed-app accounts are cleaned up"}>
          {health ? (
            <>
              <Stat label="Authorized" value={health.authorized} />
              <Stat label="Possibly removed (not confirmed)" value={health.suspected} />
              <Stat label="Confirmed removed" value={health.confirmed} />
              <Stat label="Not logged in since the update" value={Math.max(0, users.filter((u) => !u.isPlaceholder).length - health.total)} />
            </>
          ) : (
            <p className="text-sm text-ink-faint">Not available yet — run the 0007 migration first.</p>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Newest ships" action={{ href: "/admin/ships", label: "All ships →" }}>
          <ul className="flex flex-col gap-2.5">
            {[...ships].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarPair a={s.userA} b={s.userB} size={22} />
                  <span className="truncate text-sm text-ink">
                    {displayNameOf(s.userA)} × {displayNameOf(s.userB)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-ink-faint">{relativeTimeSince(s.createdAt)}</span>
              </li>
            ))}
            {ships.length === 0 && <li className="text-sm text-ink-faint">No ships yet.</li>}
          </ul>
        </Panel>

        <Panel title="Recent activity" action={{ href: "/admin/audit-log", label: "Audit log →" }}>
          <ul className="flex flex-col gap-2.5">
            {audit.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  {e.actor ? <Avatar src={e.actor.avatarUrl} alt={displayNameOf(e.actor)} size={22} /> : <span className="h-[22px] w-[22px] shrink-0 rounded-full bg-cream-200" />}
                  <span className="truncate text-ink-soft">
                    <span className="text-ink">{e.actor ? displayNameOf(e.actor) : "System"}</span> {e.action}
                    {e.targetUser ? <> → {displayNameOf(e.targetUser)}</> : null}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-ink-faint">{relativeTimeSince(e.createdAt)}</span>
              </li>
            ))}
            {audit.length === 0 && <li className="text-sm text-ink-faint">Nothing logged yet.</li>}
          </ul>
        </Panel>
      </div>
    </AdminShell>
  );
}

function pct(n: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((n / total) * 100)}%`;
}

const ACCENTS = {
  blossom: "text-blossom-600 bg-blossom-50",
  lavender: "text-lavender-600 bg-lavender-50",
  sky: "text-sky-500 bg-sky-50",
  sage: "text-sage-500 bg-sage-50",
  amber: "text-amber-600 bg-amber-50",
};

function Metric({ label, value, sub, accent, href }: { label: string; value: number; sub?: string; accent: keyof typeof ACCENTS; href?: string }) {
  const body = (
    <div className="h-full rounded-lg border border-border bg-white p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={`mt-1 inline-block rounded px-1.5 text-lg font-semibold ${ACCENTS[accent]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

function Panel({ title, note, action, className = "", children }: { title: string; note?: string; action?: { href: string; label: string }; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-lg border border-border bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action ? (
          <Link href={action.href} className="shrink-0 text-xs font-medium text-lavender-600">{action.label}</Link>
        ) : note ? (
          <span className="text-right text-xs text-ink-faint">{note}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function Row({ href, label, value, tone }: { href: string; label: string; value: number; tone: "blossom" | "amber" }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-cream-100">
        <span className="text-ink-soft">{label}</span>
        <span className={`rounded-full px-2 text-xs font-semibold ${tone === "blossom" ? "bg-blossom-50 text-blossom-600" : "bg-amber-50 text-amber-600"}`}>{value}</span>
      </Link>
    </li>
  );
}
