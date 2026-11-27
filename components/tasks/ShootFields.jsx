"use client";

// "นัดถ่าย" sessions editor (round 57.1, Production only): one row per shoot day —
// วันที่* · เวลาเริ่ม* · เวลาจบ · สถานที่ · remove — and "+ เพิ่มวันถ่าย" (consecutive
// or scattered dates). 24 h times (components/ui/TimePicker.jsx). An end time
// earlier than the start = ends the next day ("+1 วัน"). A row without an end time
// gets no Work Plan (hint under it). Used by the Edit / Create Step 2 form and the
// Task Detail "ตั้งวันถ่ายทำ / แก้ไขนัดถ่าย" dialog. Rules + the server's re-check:
// lib/tasks/shootSessions.js (parseShootSessions). Errors: "shootSessions.<i>.<field>".

import { Plus, Trash2 } from "lucide-react";
import { FieldError, input, label } from "@/components/projects/ProjectForm";
import { buttonClass } from "@/components/ui/Button";
import TimePicker from "@/components/ui/TimePicker";
import { NO_END_HINT, SESSIONS_MAX, SESSION_LOCATION_MAX, isOvernight } from "@/lib/tasks/shootSessions";
import { addDays, isDateStr } from "@/lib/tasks/workplan";

let seq = 0;
/** A new empty row (`key` is client-only; `_id` comes from the server once saved). */
export const newSessionRow = (prev) => ({
  key: `new-${++seq}`,
  _id: "",
  // The day after the last row (consecutive days are the common case).
  date: prev && isDateStr(prev.date) ? addDays(prev.date, 1) : "",
  startTime: prev?.startTime ?? "",
  endTime: prev?.endTime ?? "",
  location: prev?.location ?? "",
});

/** Rows → the posted shape (client keys dropped). */
export const sessionRowsPayload = (rows) => (rows ?? []).map(({ _id, date, startTime, endTime, location }) => ({ _id, date, startTime, endTime, location }));

/**
 * @param {{ id: string, rows: object[], onChange: (rows: object[]) => void, errors?: Record<string, string> }} props
 */
export default function ShootSessionsFields({ id, rows, onChange, errors = {} }) {
  const list = rows ?? [];
  const keyOf = (r, i) => r.key ?? r._id ?? String(i);
  const set = (i, field, value) => onChange(list.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  const add = () => onChange([...list, newSessionRow(list.at(-1))]);
  const err = (i, f) => errors[`shootSessions.${i}.${f}`];

  return (
    <div className="flex flex-col gap-3">
      {list.length === 0 && <p className="rounded-[12px] bg-card-inset px-3 py-3 text-sm text-fg-muted">ยังไม่มีวันถ่าย</p>}
      {list.map((r, i) => {
        const rid = `${id}-${i}`;
        return (
          <fieldset key={keyOf(r, i)} className="flex flex-col gap-3 rounded-[14px] border border-line p-3">
            <legend className="sr-only">วันถ่ายที่ {i + 1}</legend>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-fg">วันถ่ายที่ {i + 1}</p>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`ลบวันถ่ายที่ ${i + 1}`}
                className="flex size-8 items-center justify-center rounded-[8px] text-fg-muted hover:bg-danger/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor={`${rid}-date`} className={label}>
                  วันที่<span className="text-danger" aria-hidden="true"> *</span>
                </label>
                <input
                  id={`${rid}-date`}
                  type="date"
                  value={r.date}
                  onChange={(e) => set(i, "date", e.target.value)}
                  className={input}
                  aria-invalid={!!err(i, "date") || undefined}
                  aria-describedby={`${rid}-date-error`}
                />
                <FieldError id={`${rid}-date-error`} error={err(i, "date")} />
              </div>
              <div>
                <label htmlFor={`${rid}-start`} className={label}>
                  เวลาเริ่ม<span className="text-danger" aria-hidden="true"> *</span>
                </label>
                <TimePicker id={`${rid}-start`} value={r.startTime} onChange={(v) => set(i, "startTime", v)} invalid={!!err(i, "startTime")} describedBy={`${rid}-start-error`} />
                <FieldError id={`${rid}-start-error`} error={err(i, "startTime")} />
              </div>
              <div>
                <label htmlFor={`${rid}-end`} className={label}>เวลาจบ</label>
                <TimePicker id={`${rid}-end`} value={r.endTime} onChange={(v) => set(i, "endTime", v)} invalid={!!err(i, "endTime")} describedBy={`${rid}-end-error ${rid}-end-hint`} />
                <FieldError id={`${rid}-end-error`} error={err(i, "endTime")} />
              </div>
            </div>
            <div>
              <label htmlFor={`${rid}-location`} className={label}>สถานที่</label>
              <input
                id={`${rid}-location`}
                maxLength={SESSION_LOCATION_MAX}
                placeholder="เช่น Studio A"
                value={r.location}
                onChange={(e) => set(i, "location", e.target.value)}
                className={input}
                aria-invalid={!!err(i, "location") || undefined}
                aria-describedby={`${rid}-location-error`}
              />
              <FieldError id={`${rid}-location-error`} error={err(i, "location")} />
            </div>
            <p id={`${rid}-end-hint`} className="text-xs text-fg-muted">
              {!r.endTime ? NO_END_HINT : isOvernight(r) ? "จบวันถัดไป (+1 วัน)" : ""}
            </p>
          </fieldset>
        );
      })}
      {errors.shootSessions && <p role="alert" className="text-sm text-danger">{errors.shootSessions}</p>}
      {list.length < SESSIONS_MAX && (
        <button type="button" onClick={add} className={buttonClass("outline", "min-h-9 self-start")}>
          <Plus className="size-4" aria-hidden="true" />
          เพิ่มวันถ่าย
        </button>
      )}
    </div>
  );
}
