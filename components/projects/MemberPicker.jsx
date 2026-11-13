"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { searchAccountsAction } from "@/app/(app)/projects/actions";

const DEBOUNCE_MS = 250;

/**
 * Type-to-search combobox for project members (ARIA 1.2 combobox + listbox).
 * Searches ACTIVE accounts by name/email (max 8). The owner and already-selected
 * people are excluded; the save action re-validates and strips the owner anyway.
 * Keyboard: ↑/↓ move, Enter adds, Escape closes.
 */
export default function MemberPicker({ id, ownerId, selected, onChange, describedBy, invalid }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const listId = useId();
  const statusId = useId();

  const q = query.trim();
  const selectedIds = selected.map((m) => m.id);
  const excludeKey = [ownerId, ...selectedIds].join(",");

  // Debounced search; stale responses are dropped via the request counter.
  useEffect(() => {
    if (!q) return;
    const req = ++requestRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchAccountsAction(q, excludeKey.split(",").filter(Boolean));
      if (req !== requestRef.current) return;
      setLoading(false);
      if (res?.ok) {
        setError("");
        setResults(res.results);
        setActive(res.results.length ? 0 : -1);
      } else {
        setError(res?.error ?? "Search failed.");
        setResults([]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, excludeKey]);

  const onInput = (e) => {
    const value = e.target.value;
    setQuery(value);
    setOpen(true);
    // Show "searching" during the debounce instead of a premature "no matches".
    if (value.trim()) setLoading(true);
    if (!value.trim()) {
      requestRef.current++;
      setResults([]);
      setActive(-1);
      setLoading(false);
    }
  };

  const add = (person) => {
    if (!person || person.id === ownerId || selectedIds.includes(person.id)) return;
    onChange([...selected, person]);
    setQuery("");
    setResults([]);
    setActive(-1);
    requestRef.current++;
  };

  const remove = (personId) => onChange(selected.filter((m) => m.id !== personId));

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : -1));
    } else if (e.key === "Enter") {
      // Never submit the form from the search box.
      e.preventDefault();
      if (open && active >= 0) add(results[active]);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  const showList = open && q.length > 0;
  const optionId = (i) => `${listId}-opt-${i}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          aria-describedby={[statusId, describedBy].filter(Boolean).join(" ")}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search people by name or email"
          value={query}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          className="min-h-11 w-full rounded-[10px] border border-line bg-card py-2.5 pl-9 pr-9 text-base text-fg outline-none placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-muted" aria-hidden="true" />
        )}

        <ul
          id={listId}
          role="listbox"
          aria-label="Matching people"
          hidden={!showList}
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-[14px] border border-line bg-card p-1 shadow-xl"
        >
          {results.map((p, i) => (
            <li
              key={p.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(p)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 ${i === active ? "bg-card-inset" : ""}`}
            >
              <Avatar name={p.name} url={p.avatarUrl} size={24} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
                <span className="block truncate text-xs text-fg-muted">{p.email}</span>
              </span>
            </li>
          ))}
          {!loading && results.length === 0 && (
            <li role="presentation" className="px-2.5 py-2 text-sm text-fg-muted">
              {error || "No matching active accounts"}
            </li>
          )}
        </ul>
      </div>

      <p id={statusId} aria-live="polite" className="sr-only">
        {showList && !loading ? `${results.length} ${results.length === 1 ? "result" : "results"}` : ""}
      </p>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected members">
          {selected.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-full border border-line bg-card-inset py-1 pl-1 pr-1.5">
              <Avatar name={m.name} url={m.avatarUrl} size={24} />
              <span className="max-w-40 truncate text-sm text-fg">{m.name}</span>
              <button
                type="button"
                onClick={() => remove(m.id)}
                aria-label={`Remove ${m.name}`}
                className="flex size-7 items-center justify-center rounded-full text-fg-muted hover:bg-track hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
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
