import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { getSession } from "@/lib/session";
import { getCurrentRole, isAtLeast } from "@/lib/roles";

export default async function CreateShipPage() {
  const session = getSession();
  const role = await getCurrentRole();
  const canCreateDirectly = isAtLeast(role, "ship_creator");

  return (
    <AppShell currentUser={session}>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-ink">Create a Ship</h1>
        <p className="mt-1 text-sm text-ink-soft">Choose how you want to create a ship.</p>

        <div className={`mt-6 grid gap-4 ${canCreateDirectly ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <OptionCard
            icon={<SendIcon className="h-6 w-6 text-lavender-500" />}
            iconBg="bg-lavender-50"
            title="Send a Request"
            description={
              session
                ? "Search for someone and send a ship request. They will need to accept."
                : "Login with Discord and send a ship request to someone. They will need to accept."
            }
          >
            {/* Already logged in → go straight to the form, reusing the
                existing session, instead of forcing a fresh Discord login
                they don't need (see also /create/send/page.tsx, which
                already handles this correctly — this button just wasn't
                checking session at all). */}
            <Button href={session ? "/create/send" : "/api/auth/discord?redirect=/create/send"} className="w-full">
              {session ? "Send a Request" : "Continue with Discord"}
            </Button>
          </OptionCard>

          <OptionCard
            icon={<PeopleIcon className="h-6 w-6 text-blossom-500" />}
            iconBg="bg-blossom-50"
            title="Ask an Admin"
            description="Don't want to login? Ask an admin to create a ship for you. They'll take consent from both people."
          >
            <Button href="/team" variant="secondary" className="w-full">
              Request an Admin
            </Button>
          </OptionCard>

          {canCreateDirectly && (
            <OptionCard
              icon={<PlusIcon className="h-6 w-6 text-sage-500" />}
              iconBg="bg-sage-50"
              title="Create Directly"
              description="As a Ship Creator, make a ship by hand using just two display names."
            >
              <Button href="/create/manual" variant="secondary" className="w-full">
                Create Ship
              </Button>
            </OptionCard>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          A ship only becomes confirmed once both people have agreed to it.
        </p>
      </div>
    </AppShell>
  );
}

function OptionCard({
  icon,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center rounded-lg border border-border bg-white p-6 text-center shadow-softer">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>{icon}</div>
      <h2 className="mt-3 text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 text-sm text-ink-faint">{description}</p>
      {/* Pushes the button to the bottom so all cards' buttons line up,
          whatever the description length. */}
      <div className="flex-1" />
      <div className="mt-4 w-full">{children}</div>
    </div>
  );
}

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m3 12 18-8-6 18-3-7-7-3Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 15.2c2.5.4 4.5 2 4.5 4.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
