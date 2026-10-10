import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/session";
import { guardPage } from "@/lib/page-guard";
import { getRulesDocument } from "@/lib/data/rules";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  await guardPage("rules");
  const session = getSession();
  const sections = (await getRulesDocument()).filter((s) => s.rules.length > 0);

  return (
    <AppShell currentUser={session}>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-ink">Rules</h1>
        <p className="mt-1 text-sm text-ink-soft">A few things to keep this place cozy for everyone.</p>

        {sections.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-ink-faint">
            No rules have been posted yet.
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            {sections.map((sec) => {
              const Tag = sec.format === "bullet" ? "ul" : "ol";
              return (
                <section key={sec.id} className="rounded-lg border border-border bg-white p-5 shadow-softer">
                  <h2 className="text-base font-semibold text-ink">{sec.title}</h2>
                  <Tag className={`mt-3 space-y-2 pl-5 text-sm text-ink-soft ${sec.format === "bullet" ? "list-disc" : "list-decimal"}`}>
                    {sec.rules.map((r) => (
                      <li key={r.id} className="whitespace-pre-wrap pl-1">
                        {r.text}
                      </li>
                    ))}
                  </Tag>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
