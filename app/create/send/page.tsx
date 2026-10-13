import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/session";
import { SendRequestForm } from "./SendRequestForm";

export default function SendRequestPage() {
  const session = getSession();
  if (!session) {
    redirect("/api/auth/discord");
  }

  return (
    <AppShell currentUser={session}>
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-ink">Send a ship request</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Search for a member. They&apos;ll need to accept before the ship is confirmed.
        </p>
        <div className="mt-5">
          <SendRequestForm />
        </div>
      </div>
    </AppShell>
  );
}
