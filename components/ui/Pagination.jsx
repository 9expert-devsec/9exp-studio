import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Page links (round 56, All Tasks): ‹ 1 2 3 … 16 ›. No hooks — usable from server
// and client components. `hrefFor(page)` builds each link (the URL is the state).

/** Pages to show: first, last, current ±1, with "…" gaps. */
export function pageItems(page, pages) {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out = [];
  let prev = 0;
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (p - prev > 1) out.push(p - prev === 2 ? p - 1 : null); // a single hidden page is shown, not "…"
    out.push(p);
    prev = p;
  }
  return out;
}

const cell =
  "inline-flex size-8 items-center justify-center rounded-[8px] text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-brand-500";

/** @param {{ page: number, pages: number, hrefFor: (p: number) => string, label?: string }} props */
export default function Pagination({ page, pages, hrefFor, label = "Pagination" }) {
  if (pages <= 1) return null;
  const arrow = (to, Icon, text) =>
    to >= 1 && to <= pages ? (
      <Link href={hrefFor(to)} scroll={false} aria-label={text} className={`${cell} text-fg-muted hover:bg-card-inset hover:text-fg`}>
        <Icon className="size-4" aria-hidden="true" />
      </Link>
    ) : (
      <span aria-hidden="true" className={`${cell} text-fg-muted opacity-40`}>
        <Icon className="size-4" />
      </span>
    );
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {arrow(page - 1, ChevronLeft, "Previous page")}
      {pageItems(page, pages).map((p, i) =>
        p == null ? (
          <span key={`gap-${i}`} aria-hidden="true" className={`${cell} text-fg-muted`}>
            …
          </span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={`${cell} bg-accent-soft font-semibold text-accent-fg`}>
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} scroll={false} aria-label={`Page ${p}`} className={`${cell} text-fg-muted hover:bg-card-inset hover:text-fg`}>
            {p}
          </Link>
        )
      )}
      {arrow(page + 1, ChevronRight, "Next page")}
    </nav>
  );
}
