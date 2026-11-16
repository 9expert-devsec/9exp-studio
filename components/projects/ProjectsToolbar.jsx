"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, LayoutGrid, List, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { hasActiveFilters, parseProjectFilters, projectFiltersQuery } from "@/lib/projects/filters";
import { PROJECT_STATUS } from "@/lib/projects/status";
import { PROJECT_STATUSES } from "@/lib/projects/rules";

// Grid | List toggle, Filter popover, Create button.
// Filters are DERIVED from the URL on every render (useSearchParams) and written
// back with router.replace. Nothing is copied into state (only the popover's open flag).
export default function ProjectsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseProjectFilters(Object.fromEntries(searchParams.entries()));
  const active = hasActiveFilters(filters);

  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (next) => router.replace(`${pathname}${projectFiltersQuery({ ...filters, ...next })}`, { scroll: false });

  const toggleStatus = (s) =>
    go({
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : PROJECT_STATUSES.filter((x) => x === s || filters.statuses.includes(x)),
    });

  const seg = (isActive) =>
    `inline-flex size-[29px] items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
      isActive ? "bg-brand-500 text-navy" : "text-fg-muted hover:text-fg"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="View" className="inline-flex gap-0.5 rounded-full border border-control-line bg-control p-0.5">
        <Link
          href={`${pathname}${projectFiltersQuery({ ...filters, view: "grid" })}`}
          scroll={false}
          aria-label="Grid view"
          aria-current={filters.view === "grid" ? "true" : undefined}
          className={seg(filters.view === "grid")}
        >
          <LayoutGrid className="size-[15px]" aria-hidden="true" />
        </Link>
        <Link
          href={`${pathname}${projectFiltersQuery({ ...filters, view: "list" })}`}
          scroll={false}
          aria-label="List view"
          aria-current={filters.view === "list" ? "true" : undefined}
          className={seg(filters.view === "list")}
        >
          <List className="size-[15px]" aria-hidden="true" />
        </Link>
      </div>

      <div ref={rootRef} className="relative">
        <IconButton
          ref={buttonRef}
          icon={Filter}
          label={active ? "Filter (filters active)" : "Filter"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        />
        {active && (
          <span aria-hidden="true" className="pointer-events-none absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brand-500 ring-2 ring-page" />
        )}

        {open && (
          <div
            id={panelId}
            role="dialog"
            aria-label="Filter projects"
            className="absolute right-0 top-full z-40 mt-2 w-64 rounded-[18px] border border-line bg-card p-4 shadow-xl"
          >
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Status</legend>
              <div className="flex flex-col gap-1">
                {PROJECT_STATUSES.map((s) => (
                  <label key={s} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={filters.statuses.includes(s)}
                      onChange={() => toggleStatus(s)}
                      className="size-4 accent-brand-500"
                    />
                    {PROJECT_STATUS[s].label}
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              disabled={!active}
              onClick={() => go({ statuses: [] })}
              className={buttonClass("secondary", "mt-4 w-full")}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <Link href="/projects/new" className={buttonClass("primary")}>
        <Plus className="size-4" aria-hidden="true" />
        Create project
      </Link>
    </div>
  );
}
