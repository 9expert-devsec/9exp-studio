"use client";

// Shared MULTI-person picker (round 38: Production Videographer / Presenter).
// Picked people show as chips (avatar + name, × "Remove <name>") in the order
// added; the search box stays visible below them. Max `max` (10) per field.
// Options: avatar, name, role · email; already-picked people are hidden.
//
// allowExternal (Presenter): when the typed text matches no account, the list
// shows saved external people matching it (active ones), then a last row
// Add "<typed name>" as external presenter. External chips show initials and an
// "External" badge. A new name is saved (or reused by name) when the TASK is
// saved — server side (lib/tasks/externalPeople.js).
//
// value: [{ kind: "user", id } | { kind: "external", id } | { kind: "external", name }]
// people: [{ id, name, email, avatarUrl, roleLabel, ineligible? }]
// externals: [{ id, name, active }]
// A stored pick who no longer qualifies stays (flagged `ineligible` by the
// server) with the same hint as PersonPicker. Field label id: `${id}-label`.

import { useId, useRef, useState } from "react";
import { Plus, TriangleAlert, UserRound, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { externalNameKey, cleanExternalName } from "@/lib/tasks/production";

const OPTIONS_MAX = 50;

const initials = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

const keyOf = (e) => (e.id ? `${e.kind}:${e.id}` : `new:${externalNameKey(e.name)}`);

function Initials({ name, size = "size-6" }) {
  return (
    <span aria-hidden="true" className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-track text-[10px] font-semibold text-fg-muted`}>
      {initials(name)}
    </span>
  );
}

const ExternalBadge = () => (
  <span className="shrink-0 rounded-full bg-track px-1.5 py-px text-[10px] font-semibold text-fg-muted">External</span>
);

/**
 * @param {{ id: string, people: object[], externals?: object[], value: object[], onChange: (next: object[]) => void,
 *           allowExternal?: boolean, max?: number, error?: string, emptyText?: string }} props
 */
export default function MultiPersonPicker({
  id,
  people,
  externals = [],
  value,
  onChange,
  allowExternal = false,
  max = 10,
  error,
  emptyText = "No one to choose",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  const list = Array.isArray(value) ? value : [];
  const picked = new Set(list.map(keyOf));
  const full = list.length >= max;
  const q = query.trim().toLowerCase();

  // Chips: resolve each entry to what it shows.
  const chips = list.map((e) => {
    if (e.kind === "external") {
      const saved = e.id ? externals.find((x) => x.id === e.id) : null;
      return { entry: e, key: keyOf(e), name: saved?.name ?? e.name ?? "Unknown", external: true, isNew: !e.id };
    }
    const p = people.find((x) => x.id === e.id);
    return { entry: e, key: keyOf(e), name: p?.name ?? "Unknown user", avatarUrl: p?.avatarUrl ?? null, ineligible: !!p?.ineligible };
  });

  // Options: accounts first; externals (+ Add) only when no account matches.
  const accounts = people
    .filter((p) => !p.ineligible && !picked.has(`user:${p.id}`))
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q))
    .slice(0, OPTIONS_MAX)
    .map((p) => ({ type: "user", key: `user:${p.id}`, person: p }));
  let options = accounts;
  if (allowExternal && q && accounts.length === 0) {
    const savedMatches = externals
      .filter((x) => x.active && !picked.has(`external:${x.id}`) && x.name.toLowerCase().includes(q))
      .slice(0, OPTIONS_MAX)
      .map((x) => ({ type: "external", key: `external:${x.id}`, external: x }));
    const typed = cleanExternalName(query);
    const typedKey = externalNameKey(typed);
    const exists = externals.some((x) => externalNameKey(x.name) === typedKey) || picked.has(`new:${typedKey}`);
    options = [...savedMatches, ...(typed && !exists ? [{ type: "add", key: `add:${typedKey}`, name: typed }] : [])];
  }

  const add = (o) => {
    if (!o || full) return;
    const entry =
      o.type === "user"
        ? { kind: "user", id: o.person.id }
        : o.type === "external"
          ? { kind: "external", id: o.external.id }
          : { kind: "external", name: o.name };
    onChange([...list, entry]);
    setQuery("");
    setActive(-1);
    inputRef.current?.focus();
  };
  const remove = (key) => {
    onChange(list.filter((e) => keyOf(e) !== key));
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (options.length ? (i - 1 + options.length) % options.length : -1));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the drawer form from the search box
      if (open && active >= 0) add(options[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation(); // don't close the drawer
      setOpen(false);
    } else if (e.key === "Backspace" && !query && list.length) {
      remove(keyOf(list.at(-1)));
    }
  };

  const optionId = (i) => `${listId}-opt-${i}`;
  const ineligible = chips.some((c) => c.ineligible);
  const describedBy = [ineligible ? `${id}-warning` : null, `${id}-error`, `${id}-count`].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen people">
          {chips.map((c) => (
            <li
              key={c.key}
              className={`flex min-w-0 max-w-full items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-0.5 text-sm ${
                c.ineligible ? "border-warning/60 bg-warning/10" : "border-line bg-card-inset"
              }`}
            >
              {c.external ? <Initials name={c.name} /> : <Avatar name={c.name} url={c.avatarUrl} size={24} />}
              <span className="min-w-0 truncate text-fg">{c.name}</span>
              {c.external && <ExternalBadge />}
              {c.isNew && <span className="shrink-0 text-[10px] text-fg-muted">new</span>}
              <button
                type="button"
                onClick={() => remove(c.key)}
                aria-label={`Remove ${c.name}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-card hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        ref={wrapRef}
        className="relative"
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !full}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          aria-invalid={!!error || undefined}
          disabled={full}
          value={query}
          placeholder={full ? `Maximum ${max} people` : allowExternal ? "Search people or type a name" : "Search people"}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          className={`min-h-11 w-full rounded-[10px] border bg-card py-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60 ${
            error ? "border-danger" : "border-line"
          }`}
        />
        {open && !full && (
          <ul
            id={listId}
            role="listbox"
            aria-label="People"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-[12px] border border-line bg-card p-1 shadow-lg"
          >
            {options.length === 0 ? (
              <li role="presentation" className="px-3 py-2.5 text-sm text-fg-muted">
                {people.length || externals.length ? "No matches" : emptyText}
              </li>
            ) : (
              options.map((o, i) => (
                <li
                  key={o.key}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault() /* keep focus in the input */}
                  onClick={() => add(o)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm ${i === active ? "bg-card-inset" : ""}`}
                >
                  {o.type === "user" ? (
                    <>
                      <Avatar name={o.person.name} url={o.person.avatarUrl} size={24} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg">{o.person.name}</span>
                        {(o.person.roleLabel || o.person.email) && (
                          <span className="block truncate text-xs text-fg-muted">
                            {[o.person.roleLabel, o.person.email].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                    </>
                  ) : o.type === "external" ? (
                    <>
                      <Initials name={o.external.name} />
                      <span className="min-w-0 truncate font-medium text-fg">{o.external.name}</span>
                      <ExternalBadge />
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-fg">
                        <Plus className="size-3.5" />
                      </span>
                      <span className="min-w-0 truncate text-fg">
                        Add “<span className="font-semibold">{o.name}</span>” as external presenter
                      </span>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <p id={`${id}-count`} className="sr-only">
        {list.length} of {max} chosen
      </p>
      {ineligible && (
        <p id={`${id}-warning`} className="flex items-center gap-1.5 text-xs text-warning">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          Someone here is no longer eligible for this role — remove them or keep as is
        </p>
      )}
    </div>
  );
}
