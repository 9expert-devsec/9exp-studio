"use client";

// Searchable combobox (ARIA 1.2 combobox + listbox), the same pattern as
// components/projects/MemberPicker.jsx, made generic:
//   - options: a static list filtered as you type, OR
//   - search(q): async (debounced 250ms; stale responses dropped), called with
//     "" on open too, so the first results show before typing.
//   - single (value: option | null) or multiple (value: option[]); the chosen
//     option(s) render as chips under the input, each with a × to remove.
//   - `header`: optional content at the top of the popover (e.g. Public | Online);
//     `searchKey` re-runs the search when it changes.
// Keyboard: ↓/↑ move (↓ opens), Enter picks, Escape closes. Focus moving into the
// popover (header buttons) keeps it open.

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

const DEBOUNCE_MS = 250;
const STATIC_MAX = 50;

export default function Combobox({
  id,
  value,
  multiple = false,
  onChange,
  options,
  search,
  searchKey = "",
  getKey = (o) => o.id,
  getLabel = (o) => o.label,
  renderOption,
  renderChip,
  placeholder = "Search…",
  leadingIcon: Leading = Search,
  header,
  invalid,
  describedBy,
  emptyText = "No matches",
  listLabel = "Options",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState({ results: [], loading: false, error: "" });
  const requestRef = useRef(0);
  const wrapRef = useRef(null);
  const listId = useId();
  const statusId = useId();

  const selected = multiple ? (value ?? []) : value ? [value] : [];
  const selectedKeys = selected.map(getKey);
  const q = query.trim();
  const isAsync = typeof search === "function";

  // Async search while open (also for an empty query).
  useEffect(() => {
    if (!isAsync || !open) return;
    const req = ++requestRef.current;
    const t = setTimeout(async () => {
      setRemote((r) => ({ ...r, loading: true }));
      const res = await search(q);
      if (req !== requestRef.current) return;
      setRemote(res?.ok ? { results: res.results, loading: false, error: "" } : { results: [], loading: false, error: res?.error ?? "Search failed." });
      setActive(res?.ok && res.results.length ? 0 : -1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // `search` is recreated by parents each render; q / searchKey / open drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, searchKey, open, isAsync]);

  const pool = isAsync
    ? remote.results
    : (options ?? []).filter((o) => !q || getLabel(o).toLowerCase().includes(q.toLowerCase())).slice(0, STATIC_MAX);
  const results = multiple ? pool.filter((o) => !selectedKeys.includes(getKey(o))) : pool;
  const loading = isAsync && remote.loading;

  const pick = (o) => {
    if (!o) return;
    if (multiple) onChange([...selected, o]);
    else {
      onChange(o);
      setOpen(false);
    }
    setQuery("");
    setActive(-1);
  };
  const remove = (key) => (multiple ? onChange(selected.filter((o) => getKey(o) !== key)) : onChange(null));

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : -1));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the form from the search box
      if (open && active >= 0) pick(results[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation(); // don't close the surrounding drawer/dialog
      setOpen(false);
    }
  };

  const optionId = (i) => `${listId}-opt-${i}`;
  const label = (o) => (renderOption ? renderOption(o) : getLabel(o));

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrapRef}
        className="relative"
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        <Leading className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          aria-describedby={[statusId, describedBy].filter(Boolean).join(" ")}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          className="min-h-11 w-full rounded-[10px] border border-line bg-card py-2.5 pl-9 pr-9 text-base text-fg outline-none placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 aria-[invalid=true]:border-danger sm:text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-muted" aria-hidden="true" />
        )}

        <div
          hidden={!open}
          className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-[14px] border border-line bg-card shadow-xl"
        >
          {header && <div className="border-b border-line-subtle p-1.5">{header}</div>}
          <ul id={listId} role="listbox" aria-label={listLabel} className="max-h-64 overflow-y-auto p-1">
            {results.map((o, i) => (
              <li
                key={getKey(o)}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm text-fg ${i === active ? "bg-card-inset" : ""}`}
              >
                {label(o)}
              </li>
            ))}
            {!loading && results.length === 0 && (
              <li role="presentation" className="px-2.5 py-2 text-sm text-fg-muted">
                {remote.error || emptyText}
              </li>
            )}
          </ul>
        </div>
      </div>

      <p id={statusId} aria-live="polite" className="sr-only">
        {open && !loading ? `${results.length} ${results.length === 1 ? "result" : "results"}` : ""}
      </p>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected">
          {selected.map((o) => (
            <li key={getKey(o)} className="flex max-w-full items-center gap-2 rounded-full border border-line bg-card-inset py-1 pl-2 pr-1.5">
              <span className="flex min-w-0 items-center gap-1.5 text-sm text-fg">{renderChip ? renderChip(o) : getLabel(o)}</span>
              <button
                type="button"
                onClick={() => remove(getKey(o))}
                aria-label={`Remove ${getLabel(o)}`}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-track hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
