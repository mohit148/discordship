import { guardPage } from "@/lib/page-guard";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/session";

export default async function AboutPage() {
  await guardPage("about");
  const session = getSession();

  return (
    <AppShell currentUser={session}>
      <div className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold text-ink">About ship.</h1>

        <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-ink-soft">
          <p>
            ship. is a little board for tracking the pairs that make up this server — best friends,
            chaotic duos, running bits, and yes, the occasional couple. Most ships here are just friends.
          </p>

          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">How a ship gets made</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              <li>• Log in with Discord and send someone a request — they have to accept it.</li>
              <li>• Or ask an admin, who&apos;ll check with both people before creating it.</li>
              <li>• A ship never becomes public just because one person set it up.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">Statuses</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              <li>• <strong className="text-ink">Current</strong> — both people have agreed, and the ship is live.</li>
              <li>• <strong className="text-ink">Ended</strong> — wrapped up, but kept for the history.</li>
            </ul>
            <p className="mt-2 text-xs text-ink-faint">
              A ship waiting on the other person&apos;s confirmation isn&apos;t shown here yet.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <h2 className="text-sm font-semibold text-ink">Privacy</h2>
            <p className="mt-2">
              Your data isn&apos;t sold or used for anything unrelated to this site. Discord login only helps us identify
              your Discord account and access basic information such as your display name and avatar. Logging in also
              unlocks additional features, like creating and managing your own ship cards and requests.
            </p>
            <p className="mt-2">
              You don&apos;t need to log in just to appear in a ship — an admin can create a ship using basic information
              instead.
            </p>
          </div>

          <p>
            Something not right or need a ship changed or removed? You can reach out to an admin from the{" "}
            <Link href="/team" className="font-medium text-lavender-600 hover:underline">
              Team
            </Link>{" "}
            page.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
