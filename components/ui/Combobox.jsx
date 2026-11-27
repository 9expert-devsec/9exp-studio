"use client";

// Searchable combobox (ARIA 1.2 combobox + listbox), the same pattern as
// components/projects/MemberPicker.jsx, made generic:
//   - options: a static list filtered as you type, OR
//   - search(q): async (debounced 250ms; stale responses dropped), called with
//     "" on open too, so the first results show before typing.
//   - single (value: option | null) or multiple (value: option[]); the chosen
//     option(s) render as chips under the input, each with a × to remove.
//   - single: once picked, the search input is REPLACED by one full-width row
//     (same height as the input) showing the value — `renderValue`, else
//     `renderOption` (icon + label), else the label — plus a × ("Remove <label>").
//     Round 50: the row itself is a button carrying the field `id` (so a
//     <label for> opens the list, never clears); clicking it swaps back to the
//     search input with the list open and the current value highlighted. The ×
//     has its OWN id (`<id>-clear`) and a fixed 32×32 hit area.
//   - opens ONLY on a user action (click, typing, ArrowDown / Alt+ArrowDown) —
//     never on focus, autofocus or programmatic focus (round 50).
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
  renderValue,
  labelledBy,
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
  // Single with a value: true while the search input is shown to change it.
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState({ results: [], loading: false, error: "" });
  const requestRef = useRef(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const refocusRef = useRef(false);

  // After × clears a single value (or the value row is clicked to change it),
  // the search input comes back: focus it (focus alone never opens the list).
  useEffect(() => {
    if ((!value || editing) && refocusRef.current) {
      refocusRef.current = false;
      inputRef.current?.focus();
    }
  }, [value, editing]);
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
      setEditing(false);
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
    } else if (e.key === "Escape" && (open || editing)) {
      e.preventDefault();
      e.stopPropagation(); // don't close the surrounding drawer/dialog
      setOpen(false);
      if (editing) {
        setEditing(false);
        setQuery("");
      }
    }
  };

  const optionId = (i) => `${listId}-opt-${i}`;
  const label = (o) => (renderOption ? renderOption(o) : getLabel(o));

  // Single + a value (not being changed): the input is replaced by the value row.
  const showValueRow = !multiple && !!value && !editing;
  const showValue = (o) => (renderValue ? renderValue(o) : renderOption ? renderOption(o) : <span className="truncate">{getLabel(o)}</span>);

  const clearValue = () => {
    refocusRef.current = true;
    setQuery("");
    setActive(-1);
    setEditing(false);
    onChange(null);
  };
  /** The value row was clicked: back to the search input, list open, current value highlighted. */
  const startChange = () => {
    refocusRef.current = true;
    setEditing(true);
    setQuery("");
    setOpen(true);
    const i = isAsync ? -1 : (options ?? []).slice(0, STATIC_MAX).findIndex((o) => getKey(o) === getKey(value));
    setActive(i);
  };

  if (showValueRow) {
    return (
      <div
        role="group"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`flex min-h-11 w-full items-center gap-1.5 rounded-[10px] border bg-card py-1.5 pl-1.5 pr-1.5 text-sm text-fg ${
          invalid ? "border-danger" : "border-line"
        }`}
      >
        <button
          id={id}
          type="button"
          onClick={startChange}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              startChange();
            }
          }}
          aria-haspopup="listbox"
          aria-labelledby={labelledBy ? `${labelledBy} ${id}` : undefined}
          className="flex min-h-8 min-w-0 flex-1 items-center gap-2.5 rounded-[8px] px-1.5 text-left focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {showValue(value)}
        </button>
        <button
          id={`${id}-clear`}
          type="button"
          onClick={clearValue}
          aria-label={`Remove ${getLabel(value)}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    // relative: keeps the sr-only status line (position:absolute) inside this
    // component instead of escaping to the nearest positioned ancestor.
    <div className="relative flex flex-col gap-2">
      <div
        ref={wrapRef}
        className="relative"
        onBlur={(e) => {
          if (wrapRef.current?.contains(e.relatedTarget)) return;
          setOpen(false);
          // Changing a single value but left without picking: show the value again.
          if (editing) {
            setEditing(false);
            setQuery("");
          }
        }}
      >
        <Leading className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          ref={inputRef}
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

      {multiple && selected.length > 0 && (
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
