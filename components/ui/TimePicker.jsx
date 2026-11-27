"use client";

// THE time input of the app (round 52; grew out of the round-47.1 Work Plan
// TimeField). Always 24-hour "HH:mm" — the native <input type="time"> follows the
// OS locale (AM/PM) and can't be forced to 24 h, so it is never used.
//   typing   "9", "930", "0930", "9:30" → "09:30" on blur (lib/tasks/workplan.js
//            parseTimeInput); outside 00:00–23:59 → inline "รูปแบบเวลาไม่ถูกต้อง (เช่น 09:30)"
//   picker   the clock button opens two columns, hours 00–23 and minutes 00–59
//            (every minute), with NO visible scrollbar (`no-scrollbar`, app/globals.css);
//            the selected item is a filled pill; on open each column scrolls its
//            current value near the top. ↑/↓ move, Enter picks, Esc / outside
//            click closes. Opens upward when there is no room below (viewport or
//            the surrounding dialog).
// value / onChange: "HH:mm" or "" (an invalid typed text reports ""). Stored
// formats are unchanged: every caller already stored "HH:mm" strings.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { input } from "@/components/projects/ProjectForm";
import { TIME_FORMAT_ERROR, parseTimeInput } from "@/lib/tasks/workplan";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const POPOVER_PX = 236; // column height (h-56) + padding

/**
 * @param {{ id: string, value: string, onChange: (v: string) => void, ariaLabel?: string,
 *           invalid?: boolean, describedBy?: string, disabled?: boolean, className?: string }} props
 *   className: width of the field (e.g. "w-32")
 */
export default function TimePicker({ id, value, onChange, ariaLabel, invalid = false, describedBy, disabled = false, className = "" }) {
  const [draft, setDraft] = useState(null); // text being typed (null = show `value`)
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
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
  const toggle = () => {
    if (open) return setOpen(false);
    // Room below: the viewport, or the dialog the field sits in (it clips / scrolls).
    const r = wrapRef.current?.getBoundingClientRect();
    const box = wrapRef.current?.closest("dialog")?.getBoundingClientRect();
    const bottom = Math.min(window.innerHeight, box?.bottom ?? Infinity);
    const top = Math.max(0, box?.top ?? 0);
    setUp(!!r && r.bottom + POPOVER_PX > bottom && r.top - POPOVER_PX >= top);
    setOpen(true);
  };

  // Close when a click lands outside the field.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:mm"
        maxLength={5}
        aria-label={ariaLabel}
        disabled={disabled}
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
            toggle();
          }
        }}
        className={`${input} pr-10 font-mono tabular-nums`}
        aria-invalid={!!error || invalid || undefined}
        aria-describedby={[error ? errorId : "", describedBy].filter(Boolean).join(" ") || undefined}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label="เลือกเวลา"
        aria-expanded={open}
        className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50"
      >
        <Clock className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`absolute left-0 z-30 flex gap-1 rounded-[12px] border border-line bg-card p-1.5 shadow-xl ${up ? "bottom-full mb-1" : "top-full mt-1"}`}
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

/** One scroll column (listbox), no visible scrollbar. ↑/↓ move the active option, Enter picks it. */
function Column({ label, items, selected, onPick, autoFocus = false }) {
  const [active, setActive] = useState(() => Math.max(0, items.indexOf(selected ?? items[0])));
  const [focused, setFocused] = useState(false);
  const listRef = useRef(null);
  const baseId = useId();
  const item = (i) => listRef.current?.querySelector(`[data-i="${i}"]`);

  // On open: the current value near the top (like the native picker).
  useLayoutEffect(() => {
    const list = listRef.current;
    const el = item(active);
    if (list && el) list.scrollTop = Math.max(0, el.offsetTop - 4);
    if (autoFocus) list?.focus({ preventScroll: true });
    // first open only
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    item(active)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <ul
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${baseId}-${active}`}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setActive((i) => Math.min(items.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1))));
        } else if (e.key === "Enter") {
          e.preventDefault();
          onPick(items[active]);
        }
      }}
      className="no-scrollbar h-56 w-14 overflow-y-auto overscroll-contain py-1 outline-none"
    >
      {items.map((v, i) => {
        const isSel = v === selected;
        const isActive = focused && i === active;
        return (
          <li
            key={v}
            id={`${baseId}-${i}`}
            data-i={i}
            role="option"
            aria-selected={isSel}
            onPointerDown={(e) => e.preventDefault()} // keep focus in the column
            onClick={() => {
              setActive(i);
              onPick(v);
            }}
            className={`mx-1 cursor-pointer rounded-full py-1 text-center font-mono text-sm tabular-nums transition-colors ${
              isSel ? "bg-brand-500 font-semibold text-navy" : "text-fg hover:bg-card-inset"
            } ${isActive ? "outline-2 -outline-offset-2 outline-brand-500" : ""}`}
          >
            {v}
          </li>
        );
      })}
    </ul>
  );
}
