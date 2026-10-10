"use client";

import { useMemo, useState } from "react";
import type { Ship, ShipStatus } from "@/types";
import { SearchBar } from "@/components/SearchBar";
import { StatusFilters } from "@/components/StatusFilters";
import { Pagination } from "@/components/Pagination";
import { ShipCard } from "@/components/ShipCard";
import { SortToggle, type SortOrder } from "@/components/SortToggle";

const PAGE_SIZE = 9;

export function CardsClient({
  yourShips,
  allShips,
  myShipIds,
  viewerId,
}: {
  yourShips: Ship[];
  allShips: Ship[];
  myShipIds: Set<string>;
  viewerId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipStatus | "all">("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // allShips arrives newest-first; "oldest" just reverses the display
    // order. Numbers shown per ship are purely position-in-this-list (see
    // numberOf below), never a stored/permanent number.
    const base = sort === "oldest" ? [...allShips].reverse() : allShips;
    return base.filter((ship) => {
      if (status !== "all" && ship.status !== status) return false;
      if (!q) return true;
      return (
        ship.userA.username.toLowerCase().includes(q) ||
        ship.userB.username.toLowerCase().includes(q) ||
        (ship.userA.displayName ?? "").toLowerCase().includes(q) ||
        (ship.userB.displayName ?? "").toLowerCase().includes(q)
      );
    });
  }, [allShips, query, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageShips = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // One position map for the current filter+sort, shared by both sections
  // below, so a ship shows the same "#" everywhere on this page. A ship
  // outside the current status filter (e.g. an ended one while "Current"
  // is selected) just shows no number, since it isn't part of this list.
  const numberOf = useMemo(() => new Map(filtered.map((ship, i) => [ship.id, i + 1])), [filtered]);

  return (
    <div className="flex flex-col gap-8">
      <SearchBar
        value={query}
        onChange={(v) => {
          setQuery(v);
          setPage(1);
        }}
        placeholder="Search cards or users..."
      />

      {yourShips.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            Your Cards
            <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-xs font-medium text-lavender-600">
              {yourShips.length}
            </span>
          </h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {yourShips.map((ship) => (
              <div key={ship.id} className="w-64 shrink-0">
                <ShipCard ship={ship} canEdit viewerId={viewerId} displayNumber={numberOf.get(ship.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-ink">All Cards</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <StatusFilters
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
            <SortToggle
              value={sort}
              onChange={(v) => {
                setSort(v);
                setPage(1);
              }}
            />
          </div>
        </div>

        {pageShips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink">No cards here yet</p>
            <p className="text-sm text-ink-faint">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageShips.map((ship) => (
              <ShipCard key={ship.id} ship={ship} canEdit={myShipIds.has(ship.id)} viewerId={viewerId} displayNumber={numberOf.get(ship.id)} />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>
    </div>
  );
}
