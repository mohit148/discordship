import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { getRulesDocument } from "@/lib/data/rules";
import { RulesEditor } from "./RulesEditor";

export default async function AdminRulesPage() {
  const session = getSession()!;
  const [sections] = await Promise.all([getRulesDocument()]);

  return (
    <AdminShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Rules</h1>
      <p className="mt-1 text-sm text-ink-soft">
        What shows on the public Rules page. Add sections, then rules inside them — numbered or bulleted.
      </p>
      <div className="mt-5 max-w-2xl">
        <RulesEditor initialSections={sections} />
      </div>
    </AdminShell>
  );
}
