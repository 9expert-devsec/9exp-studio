"use client";

// Content tab toolbar: search · status · "+ Add content".
// q and status come from the server page, parsed from searchParams on every render;
// nothing is mirrored into state. Typing replaces ?q= after ~300ms (the input is
// uncontrolled and re-synced when the URL changes from elsewhere, e.g. "Clear
// filters"); the status select shows the pending choice optimistically.

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { CONTENT_SEARCH_MAX, contentFiltersQuery } from "@/lib/projects/filters";
import { PROJECT_STATUS } from "@/lib/projects/status";
import { PROJECT_STATUSES } from "@/lib/projects/rules";

const DEBOUNCE_MS = 300;
const control =
  "min-h-10 rounded-full border border-control-line bg-control px-4 text-base text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:text-sm";

export default function ContentToolbar({ basePath, q, status, addHref }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const timer = useRef(null);
  const [shownStatus, setShownStatus] = useOptimistic(status);
  const [, startTransition] = useTransition();

  const replace = (next) =>
    router.replace(`${basePath}${contentFiltersQuery(next)}`, { scroll: false });

  // URL changed from elsewhere (and the user isn't mid-debounce): show it.
  useEffect(() => {
    const el = inputRef.current;
    if (el && timer.current === null && el.value.trim() !== q) el.value = q;
  }, [q]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onSearch = (e) => {
    const value = e.target.value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      startTransition(() => replace({ q: value, status }));
    }, DEBOUNCE_MS);
  };

  const onStatus = (e) => {
    const next = e.target.value;
    clearTimeout(timer.current);
    timer.current = null;
    startTransition(() => {
      setShownStatus(next);
      replace({ q: inputRef.current?.value ?? q, status: next });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-[200px]">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          defaultValue={q}
          onChange={onSearch}
          maxLength={CONTENT_SEARCH_MAX}
          placeholder="Search content…"
          aria-label="Search content"
          className={`${control} w-full pl-9`}
        />
      </div>
      <select value={shownStatus} onChange={onStatus} aria-label="Filter by status" className={`${control} pr-8`}>
        <option value="">All statuses</option>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS[s].label}
          </option>
        ))}
      </select>
      {addHref && (
        <Link href={addHref} className={buttonClass("primary")}>
          <Plus className="size-4" aria-hidden="true" />
          Add content
        </Link>
      )}
    </div>
  );
}
