import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { devStore, type RuleSection } from "./dev-store";
import { randomUUID } from "crypto";

export type { RuleSection };
export const RULE_TEXT_MAX = 1000;
export const SECTION_TITLE_MAX = 80;

export async function getRulesDocument(): Promise<RuleSection[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = createClient();
      const [s, r] = await Promise.all([
        sb.from("rule_sections").select("*").order("position"),
        sb.from("rules").select("*").order("position"),
      ]);
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      return (s.data ?? []).map((sec: any) => ({
        id: sec.id,
        title: sec.title,
        format: sec.format,
        rules: (r.data ?? []).filter((x: any) => x.section_id === sec.id).map((x: any) => ({ id: x.id, text: x.text })),
      }));
    } catch (err) {
      console.error("Failed to load rules", err);
      return [];
    }
  }
  return devStore.get().ruleSections;
}

export function validateRulesDocument(input: unknown): { ok: true; doc: RuleSection[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Invalid rules." };
  if (input.length > 50) return { ok: false, error: "Too many sections (max 50)." };
  const doc: RuleSection[] = [];
  for (const sec of input) {
    const title = typeof sec?.title === "string" ? sec.title.trim() : "";
    if (!title) return { ok: false, error: "Every section needs a title." };
    if (title.length > SECTION_TITLE_MAX) return { ok: false, error: `Section titles can be up to ${SECTION_TITLE_MAX} characters.` };
    const format = sec?.format === "bullet" ? "bullet" : "numbered";
    const rawRules = Array.isArray(sec?.rules) ? sec.rules : [];
    if (rawRules.length > 200) return { ok: false, error: "Too many rules in one section (max 200)." };
    const rules = [];
    for (const r of rawRules) {
      const text = typeof r?.text === "string" ? r.text.trim() : "";
      if (!text) continue; // blank rules are dropped
      if (text.length > RULE_TEXT_MAX) return { ok: false, error: `Rules can be up to ${RULE_TEXT_MAX} characters.` };
      rules.push({ id: randomUUID(), text });
    }
    doc.push({ id: randomUUID(), title, format, rules });
  }
  return { ok: true, doc };
}

/** Replaces the whole rules document. New rows go in before the old ones go out, so a failure never leaves it empty. */
export async function saveRulesDocument(doc: RuleSection[]) {
  if (isSupabaseConfigured()) {
    const sb = createServiceRoleClient();
    const [oldSections] = await Promise.all([sb.from("rule_sections").select("id")]);
    const oldIds = (oldSections.data ?? []).map((x: any) => x.id);
    if (doc.length > 0) {
      const { error: e1 } = await sb
        .from("rule_sections")
        .insert(doc.map((s, i) => ({ id: s.id, title: s.title, format: s.format, position: i })));
      if (e1) throw e1;
      const ruleRows = doc.flatMap((s) => s.rules.map((r, i) => ({ id: r.id, section_id: s.id, text: r.text, position: i })));
      if (ruleRows.length > 0) {
        const { error: e2 } = await sb.from("rules").insert(ruleRows);
        if (e2) {
          await sb.from("rule_sections").delete().in("id", doc.map((s) => s.id));
          throw e2;
        }
      }
    }
    if (oldIds.length > 0) {
      const { error } = await sb.from("rule_sections").delete().in("id", oldIds); // rules cascade
      if (error) throw error;
    }
    return;
  }
  devStore.update((s) => {
    s.ruleSections = doc;
  });
}
