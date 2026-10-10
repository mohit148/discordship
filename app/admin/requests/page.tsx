import { AdminShell } from "@/components/AdminShell";
import { AdminRequestRow } from "@/components/AdminRequestRow";
import { getSession } from "@/lib/session";
import { getPendingRequests } from "@/lib/data/requests";

export default async function AdminRequestsPage() {
  const session = getSession()!;
  const pending = await getPendingRequests();

  return (
    <AdminShell currentUser={session} pendingCount={pending.length}>
      <h1 className="text-xl font-semibold text-ink">Requests</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Approve or reject 2-auth ship requests. Both people must already have consented on their end.
      </p>

      <div className="mt-5 rounded-lg border border-border bg-white p-4">
        {pending.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">No pending requests right now.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((req) => (
              <AdminRequestRow key={req.id} request={req} />
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
