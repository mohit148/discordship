"use client";

/** Page numbers to show: always first and last, plus a window around the current page, with "…" gaps. */
function pageList(page: number, total: number): (number | "gap-l" | "gap-r")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "gap-l" | "gap-r")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) out.push("gap-l");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("gap-r");
  out.push(total);
  return out;
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-200 disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Previous page"
      >
        ‹
      </button>
      {pageList(page, totalPages).map((p) =>
        typeof p === "string" ? (
          <span key={p} className="px-1 text-ink-faint">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`h-8 w-8 rounded-full text-sm transition-colors ${p === page ? "bg-lavender-500 text-white" : "text-ink-soft hover:bg-cream-200"}`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-200 disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}
