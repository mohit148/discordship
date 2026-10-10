"use client";

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

  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-md px-2 py-1 text-ink-soft hover:bg-cream-200 disabled:opacity-30"
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`h-8 w-8 rounded-md text-sm ${
            p === page ? "bg-lavender-500 text-white" : "text-ink-soft hover:bg-cream-200"
          }`}
        >
          {p}
        </button>
      ))}
      {totalPages > 5 && <span className="px-1 text-ink-faint">…</span>}
      {totalPages > 5 && (
        <button
          onClick={() => onChange(totalPages)}
          className="h-8 w-8 rounded-md text-sm text-ink-soft hover:bg-cream-200"
        >
          {totalPages}
        </button>
      )}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-md px-2 py-1 text-ink-soft hover:bg-cream-200 disabled:opacity-30"
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}
