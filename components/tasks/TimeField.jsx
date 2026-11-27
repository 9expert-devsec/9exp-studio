"use client";

// 24-hour time field (round 47.1) — replaces the native <input type="time"> in Work
// Plan: those follow the OS locale (AM/PM) and, with a `step`, shift their minute
// list to an off-grid value (09:31 → 36, 41, …). This one always shows "HH:mm".
//   typing   "9", "930", "0930", "9:30" → "09:30" on blur (lib/tasks/workplan.js
//            parseTimeInput); invalid → inline "รูปแบบเวลาไม่ถูกต้อง (เช่น 09:30)"
//   picker   the clock button opens two scroll columns: hours 00–23, minutes
//            00–59 (every minute). ↑/↓ move, Enter picks, Esc closes.
// value / onChange: "HH:mm" or "" (an invalid typed text reports "").

import { useEffect, useId, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { input } from "@/components/projects/ProjectForm";
import { TIME_FORMAT_ERROR, parseTimeInput } from "@/lib/tasks/workplan";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export default function TimeField({ id, value, onChange, ariaLabel, invalid = false, describedBy }) {
  const [draft, setDraft] = useState(null); // text being typed (null = show `value`)
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const errorId = useId();
  const [hh, mm] = /^\d{2}:\d{2}$/.test(value ?? "") ? value.split(":") : [null, null];

  const commit = () => {
    if (draft == null) return;
    const t = parseTimeInput(draft);
    if (t == null) {
      setError(TIME_FORMAT_ERROR);
      onChange("");
      return;
    }
    setError("");
    setDraft(null);
    onChange(t);
  };
  const pick = (h, m) => {
    setDraft(null);
    setError("");
    onChange(`${h}:${m}`);
  };

  // Close when focus / a click leaves the field.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:mm"
        maxLength={5}
        aria-label={ariaLabel}
        value={draft ?? value ?? ""}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError("");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "ArrowDown" && e.altKey) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`${input} pr-10 font-mono tabular-nums`}
        aria-invalid={!!error || invalid || undefined}
        aria-describedby={[error ? errorId : "", describedBy].filter(Boolean).join(" ") || undefined}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="เลือกเวลา"
        aria-expanded={open}
        className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <Clock className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="absolute left-0 z-30 mt-1 flex gap-1 rounded-[12px] border border-line bg-card p-1.5 shadow-xl"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation(); // keep the dialog open
              setOpen(false);
              document.getElementById(id)?.focus();
            }
          }}
        >
          <Column
            label="ชั่วโมง"
            items={HOURS}
            selected={hh}
            onPick={(h) => {
              pick(h, mm ?? "00");
              wrapRef.current?.querySelectorAll('[role="listbox"]')[1]?.focus(); // then the minutes
            }}
            autoFocus
          />
          <Column
            label="นาที"
            items={MINUTES}
            selected={mm}
            onPick={(m) => {
              pick(hh ?? "00", m);
              setOpen(false);
              document.getElementById(id)?.focus();
            }}
          />
        </div>
      )}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** One scroll column (listbox). ↑/↓ move the active option, Enter picks it. */
function Column({ label, items, selected, onPick, autoFocus = false }) {
  const [active, setActive] = useState(() => Math.max(0, items.indexOf(selected ?? items[0])));
  const listRef = useRef(null);
  const baseId = useId();
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  useEffect(() => {
    if (autoFocus) listRef.current?.focus({ preventScroll: true });
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "center" });
    // first open only
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ul
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${baseId}-${active}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setActive((i) => Math.min(items.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1))));
        } else if (e.key === "Enter") {
          e.preventDefault();
          onPick(items[active]);
        }
      }}
      className="h-56 w-14 overflow-y-auto rounded-[8px] py-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {items.map((v, i) => (
        <li
          key={v}
          id={`${baseId}-${i}`}
          data-i={i}
          role="option"
          aria-selected={v === selected}
          onPointerDown={(e) => e.preventDefault()} // keep focus in the column
          onClick={() => {
            setActive(i);
            onPick(v);
          }}
          className={`mx-1 cursor-pointer rounded-[6px] py-1 text-center font-mono text-sm tabular-nums ${
            v === selected ? "bg-brand-500 font-semibold text-navy" : i === active ? "bg-card-inset text-fg" : "text-fg hover:bg-card-inset"
          }`}
        >
          {v}
        </li>
      ))}
    </ul>
  );
}
