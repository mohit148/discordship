"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

interface Rule {
  id: string;
  text: string;
}
interface Section {
  id: string;
  title: string;
  format: "numbered" | "bullet";
  rules: Rule[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const smallBtn =
  "rounded px-1.5 py-0.5 text-xs text-ink-faint hover:bg-cream-200 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";

export function RulesEditor({ initialSections }: { initialSections: Section[] }) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function change(next: Section[]) {
    setSections(next);
    setDirty(true);
    setSaved(false);
  }
  function patchSection(id: string, patch: Partial<Section>) {
    change(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Failed (${res.status}).`);
        return;
      }
      setSections(body.sections);
      setDirty(false);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {sections.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-ink-faint">
          No rules yet. Add a section to get started.
        </p>
      )}

      {sections.map((sec, si) => (
        <div key={sec.id} className="rounded-lg border border-border bg-white p-4 shadow-softer">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={sec.title}
              maxLength={80}
              onChange={(e) => patchSection(sec.id, { title: e.target.value })}
              placeholder="Section title"
              className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm font-medium text-ink placeholder:text-ink-faint focus:border-lavender-400"
            />
            <select
              value={sec.format}
              onChange={(e) => patchSection(sec.id, { format: e.target.value as Section["format"] })}
              className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
              aria-label="List style"
            >
              <option value="numbered">Numbered</option>
              <option value="bullet">Bullets</option>
            </select>
            <button type="button" className={smallBtn} disabled={si === 0} onClick={() => change(swap(sections, si, si - 1))} aria-label="Move section up">
              ▲
            </button>
            <button type="button" className={smallBtn} disabled={si === sections.length - 1} onClick={() => change(swap(sections, si, si + 1))} aria-label="Move section down">
              ▼
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-xs text-blossom-600 hover:bg-blossom-50"
              onClick={() => {
                if (window.confirm(`Delete the section "${sec.title || "Untitled"}" and its rules?`)) {
                  change(sections.filter((s) => s.id !== sec.id));
                }
              }}
            >
              Delete
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {sec.rules.map((rule, ri) => (
              <li key={rule.id} className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-right text-xs text-ink-faint">
                  {sec.format === "numbered" ? `${ri + 1}.` : "•"}
                </span>
                <textarea
                  value={rule.text}
                  maxLength={1000}
                  rows={2}
                  onChange={(e) =>
                    patchSection(sec.id, { rules: sec.rules.map((r) => (r.id === rule.id ? { ...r, text: e.target.value } : r)) })
                  }
                  placeholder="Write a rule…"
                  className="min-w-0 flex-1 resize-y rounded-lg border border-border bg-white p-2 text-sm text-ink placeholder:text-ink-faint focus:border-lavender-400"
                />
                <div className="flex flex-col">
                  <button type="button" className={smallBtn} disabled={ri === 0} onClick={() => patchSection(sec.id, { rules: swap(sec.rules, ri, ri - 1) })} aria-label="Move rule up">
                    ▲
                  </button>
                  <button type="button" className={smallBtn} disabled={ri === sec.rules.length - 1} onClick={() => patchSection(sec.id, { rules: swap(sec.rules, ri, ri + 1) })} aria-label="Move rule down">
                    ▼
                  </button>
                  <button type="button" className="rounded px-1.5 py-0.5 text-xs text-blossom-600 hover:bg-blossom-50" onClick={() => patchSection(sec.id, { rules: sec.rules.filter((r) => r.id !== rule.id) })} aria-label="Delete rule">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="mt-3 text-xs font-medium text-lavender-600 hover:text-lavender-700"
            onClick={() => patchSection(sec.id, { rules: [...sec.rules, { id: uid(), text: "" }] })}
          >
            + Add rule
          </button>
        </div>
      ))}

      <Button
        variant="secondary"
        type="button"
        onClick={() => change([...sections, { id: uid(), title: "", format: "numbered", rules: [] }])}
      >
        + Add section
      </Button>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-border bg-cream/95 px-1 py-3 backdrop-blur">
        <Button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save rules"}
        </Button>
        {dirty && !saving && <span className="text-xs text-ink-faint">Unsaved changes</span>}
        {saved && !dirty && <span className="text-xs text-sage-600">Saved</span>}
        {error && <span className="text-xs text-blossom-600">{error}</span>}
      </div>
    </div>
  );
}
