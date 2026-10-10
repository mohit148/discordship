"use client";

import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import type { DiscordUser } from "@/types";
import { displayNameOf } from "@/lib/user-display";

export function SendRequestForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscordUser[]>([]);
  const [selected, setSelected] = useState<DiscordUser | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(value: string) {
    setQuery(value);
    setSelected(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    // TODO: replace with a real Supabase lookup:
    // GET /api/users/search?q=...  →  select * from users where username ilike '%q%' limit 8
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`);
    if (res.ok) setResults(await res.json());
  }

  async function handleSend() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: selected.id }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Failed (${res.status}). Check the server console for details.`);
      }
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent && selected) {
    return (
      <div className="rounded-lg border border-sage-100 bg-sage-50 p-4 text-sm text-ink">
        Sent! We&apos;ll let you know once <strong>{displayNameOf(selected)}</strong> responds.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBar value={query} onChange={handleSearch} placeholder="Search by username..." />

      {results.length > 0 && (
        <ul className="rounded-lg border border-border bg-white">
          {results.map((user) => (
            <li key={user.id}>
              <button
                onClick={() => setSelected(user)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-cream-100 ${
                  selected?.id === user.id ? "bg-lavender-50" : ""
                }`}
              >
                <Avatar src={user.avatarUrl} alt={displayNameOf(user)} size={24} />
                {displayNameOf(user)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button onClick={handleSend} disabled={!selected || submitting}>
        {submitting ? "Sending…" : "Send request"}
      </Button>
      {error && <p className="text-xs text-blossom-600">{error}</p>}
    </div>
  );
}
