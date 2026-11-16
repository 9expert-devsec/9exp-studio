"use client";

// URL-driven list toolbar, shared by the Content tab (kind="content": search ·
// status · "+ Add content") and the content detail Tasks section (kind="tasks":
// search · status · "Due date ↑/↓" sort · Cards|Table view · "+ Add task").
// `filters` come from the server page, parsed from searchParams on every render;
// nothing is mirrored into state. Typing replaces ?q= after ~300ms (the input is
// uncontrolled and re-synced when the URL changes from elsewhere, e.g. "Clear
// filters"); the status select shows the pending choice optimistically. Sort and
// view are plain links.

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LayoutGrid, Plus, Search, Table2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { CONTENT_SEARCH_MAX, contentFiltersQuery, taskFiltersQuery } from "@/lib/projects/filters";
import { PROJECT_STATUS } from "@/lib/projects/status";
import { PROJECT_STATUSES } from "@/lib/projects/rules";

const DEBOUNCE_MS = 300;
const QUERY = { content: contentFiltersQuery, tasks: taskFiltersQuery };
const control =
  "min-h-10 rounded-full border border-control-line bg-control px-4 text-base text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:text-sm";
const chip =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-control-line bg-control px-4 text-sm font-medium text-fg transition-colors hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const segBase =
  "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const segOn = `${segBase} bg-accent-soft text-accent-fg`;
const segOff = `${segBase} text-fg-muted hover:text-fg`;

/**
 * @param {{ kind?: "content" | "tasks", basePath: string,
 *           filters: { q: string, status: string, sort?: string, view?: string },
 *           addHref?: string | null, addLabel?: string, addDisabled?: boolean }} props
 *   addDisabled: render the add button disabled ("Coming soon").
 */
export default function ContentToolbar({ kind = "content", basePath, filters, addHref, addLabel, addDisabled = false }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const timer = useRef(null);
  const [shownStatus, setShownStatus] = useOptimistic(filters.status);
  const [, startTransition] = useTransition();
  const toQuery = QUERY[kind] ?? contentFiltersQuery;
  const hrefFor = (next) => `${basePath}${toQuery({ ...filters, ...next })}`;
  const replace = (next) => router.replace(hrefFor(next), { scroll: false });
  const isTasks = kind === "tasks";
  const q = filters.q;

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
      startTransition(() => replace({ q: value }));
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

  const label = addLabel ?? (isTasks ? "Add task" : "Add content");
  const noun = isTasks ? "tasks" : "content";

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
          placeholder={`Search ${noun}…`}
          aria-label={`Search ${noun}`}
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

      {isTasks && (
        <>
          <Link
            href={hrefFor({ sort: filters.sort === "due_desc" ? "due_asc" : "due_desc" })}
            scroll={false}
            replace
            className={chip}
            aria-label={`Sort by due date, ${filters.sort === "due_desc" ? "descending" : "ascending"} (change)`}
          >
            Due date
            {filters.sort === "due_desc" ? (
              <ArrowDown className="size-4" aria-hidden="true" />
            ) : (
              <ArrowUp className="size-4" aria-hidden="true" />
            )}
          </Link>
          <div role="group" aria-label="View" className="inline-flex gap-0.5 rounded-full border border-control-line bg-control p-0.5">
            <Link
              href={hrefFor({ view: "cards" })}
              scroll={false}
              replace
              aria-current={filters.view === "cards" ? "true" : undefined}
              className={filters.view === "cards" ? segOn : segOff}
            >
              <LayoutGrid className="size-4" aria-hidden="true" />
              Cards
            </Link>
            <Link
              href={hrefFor({ view: "table" })}
              scroll={false}
              replace
              aria-current={filters.view === "table" ? "true" : undefined}
              className={filters.view === "table" ? segOn : segOff}
            >
              <Table2 className="size-4" aria-hidden="true" />
              Table
            </Link>
          </div>
        </>
      )}

      {addDisabled ? (
        <button type="button" disabled title="Coming soon" className={buttonClass("primary")}>
          <Plus className="size-4" aria-hidden="true" />
          {label}
        </button>
      ) : (
        addHref && (
          <Link href={addHref} className={buttonClass("primary")}>
            <Plus className="size-4" aria-hidden="true" />
            {label}
          </Link>
        )
      )}
    </div>
  );
}
