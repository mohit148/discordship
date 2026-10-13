"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  key: string;
  label: string;
  href: string;
  visible: boolean;
}

export function NavManager({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: unknown, optimistic: Item[]) {
    const previous = items;
    setItems(optimistic);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/nav", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems(previous);
        setError(data.error || `Failed (${res.status}).`);
        return;
      }
      setItems(data.items);
      router.refresh();
    } catch {
      setItems(previous);
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    send({ order: next.map((i) => i.key) }, next);
  }

  function toggle(key: string) {
    const target = items.find((i) => i.key === key)!;
    send(
      { key, visible: !target.visible },
      items.map((i) => (i.key === key ? { ...i, visible: !i.visible } : i))
    );
  }

  return (
    <div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-white shadow-softer">
        {items.map((item, i) => (
          <li key={item.key} className="flex items-center gap-3 px-4 py-3">
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Move ${item.label} up`}
                disabled={busy || i === 0}
                onClick={() => move(i, -1)}
                className="px-1 text-xs leading-none text-ink-faint hover:text-ink disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label={`Move ${item.label} down`}
                disabled={busy || i === items.length - 1}
                onClick={() => move(i, 1)}
                className="px-1 text-xs leading-none text-ink-faint hover:text-ink disabled:opacity-30"
              >
                ▼
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${item.visible ? "text-ink" : "text-ink-faint"}`}>{item.label}</p>
              <p className="text-xs text-ink-faint">
                {item.href} · {item.visible ? "Shown" : "Hidden"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={item.visible}
              aria-label={`${item.visible ? "Hide" : "Show"} ${item.label}`}
              disabled={busy}
              onClick={() => toggle(item.key)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                item.visible ? "bg-lavender-500" : "bg-cream-200"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-softer transition-transform ${
                  item.visible ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-blossom-600">{error}</p>}
    </div>
  );
}
