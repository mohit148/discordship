import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCurrentRole, isAtLeast } from "@/lib/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();

  if (!session) {
    redirect("/api/auth/discord?redirect=/admin");
  }

  // Live check, not the session cookie's cached isAdmin flag — that's just
  // a snapshot from whenever they logged in, so trusting it here would mean
  // a promotion (or demotion) made through the Admin Portal wouldn't take
  // effect until their next login. See lib/roles.ts.
  const role = await getCurrentRole();
  if (!isAtLeast(role, "admin")) {
    redirect("/");
  }

  return <>{children}</>;
}
