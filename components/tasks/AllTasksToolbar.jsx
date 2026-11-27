"use client";

// All Tasks toolbar (round 56): search · ตัวกรอง (modal) · จัดกลุ่ม (menu).
// State is DERIVED from the URL on every render (useSearchParams → parseAllTasks).
// The ONLY local copies: the search box's in-progress text (debounced 300ms into
// ?q=, then dropped) and the open flags of the modal / menu. Every change resets
// the page to 1 (allTasksQuery). router.replace runs in a transition, so the
// current table stays on screen until the new one is ready.

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Filter, Search, X } from "lucide-react";
import { activeFilterCount, groupsFor, tasksHref } from "@/lib/tasks/allTasksFilters";
import { useAllTasksState } from "./useAllTasksState";
import AllTasksFilterModal from "./AllTasksFilterModal";
import { TOOLBAR_H } from "./allTasksStyles";

const SEARCH_DEBOUNCE_MS = 300;
const control = `${TOOLBAR_H} inline-flex shrink-0 items-center gap-2 rounded-[10px] border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500`;
const idle = "border-line bg-card text-fg hover:bg-card-inset";
const on = "border-brand-500 bg-accent-soft text-accent-fg";

/** @param {{ projects: {id:string,label:string,icon?:string}[], people: {id:string,label:string,avatarUrl:string|null}[] }} props */
export default function AllTasksToolbar({ projects, people }) {
  const router = useRouter();
  const f = useAllTasksState();
  const [, startTransition] = useTransition();
  const go = (changes) =>
    startTransition(() => router.replace(tasksHref(f, changes), { scroll: false }));

  // ── Search: local text while typing, debounced into ?q= ──
  const [draft, setDraft] = useState(null); // null = show the URL's q
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onSearch = (text) => {
    setDraft(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => {
        router.replace(tasksHref(f, { q: text.trim() }), { scroll: false });
        setDraft((d) => (d === text ? null : d)); // kept if the user typed on meanwhile
      });
    }, SEARCH_DEBOUNCE_MS);
  };
  const search = draft ?? f.q;

  const [filterOpen, setFilterOpen] = useState(false);
  const nFilters = activeFilterCount(f);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={`relative flex ${TOOLBAR_H} min-w-[220px] flex-1 items-center`}>
        <span className="sr-only">ค้นหา</span>
        <Search className="pointer-events-none absolute left-3.5 size-4 text-fg-muted" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={f.scope !== "mine" ? "ค้นหาชื่อ Task, รหัส หรือโปรเจกต์" : f.ws === "done" ? "ค้นหาในงานที่เสร็จแล้ว" : "ค้นหาชื่อ Task, รหัส หรือโปรเจกต์ ในงานของฉัน"}
          maxLength={100}
          className="h-full w-full rounded-[10px] border border-line bg-card pl-10 pr-10 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button
            type="button"
            aria-label="ล้างคำค้นหา"
            onClick={() => {
              clearTimeout(timer.current);
              setDraft(null);
              go({ q: "" });
            }}
            className="absolute right-1.5 flex size-7 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </label>

      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        aria-haspopup="dialog"
        className={`${control} ${nFilters ? on : idle}`}
      >
        <Filter className="size-4" aria-hidden="true" />
        ตัวกรอง
        {nFilters > 0 && (
          <span className="inline-flex min-w-5 justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-navy">
            {nFilters}
            <span className="sr-only"> ตัวกรองที่ใช้อยู่</span>
          </span>
        )}
      </button>

      {/* Round 57: no grouping in the calendar (the param stays for the way back). */}
      {f.view !== "calendar" && <GroupMenu options={groupsFor(f)} value={f.group} onPick={(group) => go({ group })} />}

      <AllTasksFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        f={f}
        projects={projects}
        people={people}
        onApply={(changes) => {
          setFilterOpen(false);
          go(changes);
        }}
      />
    </div>
  );
}

/** "จัดกลุ่ม: …" — a menu of radio items; orange once a grouping is on. */
function GroupMenu({ options, value, onPick }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();
  const current = options.find((g) => g.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    rootRef.current?.querySelector('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...rootRef.current.querySelectorAll('[role="menuitemradio"]')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`${control} ${value ? on : idle}`}
      >
        จัดกลุ่ม: {current.label}
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="จัดกลุ่ม"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-40 mt-2 w-48 rounded-[14px] border border-line bg-card p-1.5 shadow-xl"
        >
          {options.map((g) => {
            const checked = g.key === value;
            return (
              <button
                key={g.key || "none"}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                  if (!checked) onPick(g.key);
                }}
                className={`flex min-h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-sm outline-none hover:bg-card-inset focus-visible:bg-card-inset ${
                  checked ? "font-semibold text-accent-fg" : "text-fg"
                }`}
              >
                <Check className={`size-4 shrink-0 ${checked ? "" : "invisible"}`} aria-hidden="true" />
                {g.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
