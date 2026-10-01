"use client";

import { useMemo, useState } from "react";
import type { Ship, ShipStatus } from "@/types";
import { SearchBar } from "@/components/SearchBar";
import { StatusFilters } from "@/components/StatusFilters";
import { ShipTable } from "@/components/ShipTable";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/Button";
import { SortToggle, type SortOrder } from "@/components/SortToggle";

const PAGE_SIZE = 10;

export function HomeClient({ initialShips }: { initialShips: Ship[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShipStatus | "all">("confirmed");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // initialShips arrives newest-first; "oldest" just reverses the display
    // order. The "#" shown per ship is purely its position in this final
    // list (see ShipTable's startIndex), never a stored/permanent number —
    // so it's always sequential with no gaps, however this is filtered or
    // sorted.
    const base = sort === "oldest" ? [...initialShips].reverse() : initialShips;
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
  }, [initialShips, query, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageShips = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBar value={query} onChange={(v) => { setQuery(v); setPage(1); }} />
        <Button href="/create">+ Create Ship</Button>
      </div>

      <div className="flex items-center justify-between gap-3">
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

      <ShipTable ships={pageShips} startIndex={(page - 1) * PAGE_SIZE} />

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
