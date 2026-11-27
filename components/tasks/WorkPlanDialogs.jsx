"use client";

// Work Plan dialogs (round 47, Figma 307:70 / 341:3308 Add plan, 307:9 / 341:3249
// Log time). Every check is lib/tasks/workplan.js — the SAME functions the server
// actions (workplan-actions.js) run again on save. The person's entries on OTHER
// tasks (for the overlap checks) come from loadWorkContextAction.
//   PlanDialog  Add plan (several cards, all-or-nothing) / Edit plan (one card + ลบ)
//   LogDialog   Log time (one date: ranges or hours) / Edit log (one entry + ลบ)

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Ban, Info, Loader2, Plus, Trash2, X } from "lucide-react";
import { deleteWorkEntryAction, loadWorkContextAction, saveLogsAction, savePlansAction } from "@/app/(app)/projects/workplan-actions";
import { invalidateTaskPanel } from "@/components/tasks/panelCache";
import { buttonClass } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { input, label } from "@/components/projects/ProjectForm";
import { formatThaiDay } from "@/lib/projects/format";
import TimePicker from "@/components/ui/TimePicker";
import {
  addDays,
  checkLogs,
  checkPlans,
  daySummary,
  entryMinutes,
  formatDuration,
  formatOver,
  parseEntry,
  pastDueDays,
  pastDueWarning,
} from "@/lib/tasks/workplan";

// ── Shared bits ───────────────────────────────────────────────────────────

/** Two-option segmented control (radio group). */
export function Segmented({ name, value, onChange, options }) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-[12px] border border-line p-1">
      {options.map((o) => (
        <label
          key={o.key}
          className="flex min-h-9 cursor-pointer items-center justify-center rounded-[10px] border border-transparent px-2 text-center text-sm text-fg-muted transition-colors hover:text-fg has-[:checked]:border-brand-500 has-[:checked]:bg-accent-soft has-[:checked]:font-semibold has-[:checked]:text-accent-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500"
        >
          <input type="radio" name={name} value={o.key} checked={value === o.key} onChange={() => onChange(o.key)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

const baseForm = (panel, person) => {
  const fd = new FormData();
  fd.set("projectId", panel.projectId);
  fd.set("contentId", panel.contentId);
  fd.set("taskId", panel.id);
  fd.set("person", person);
  return fd;
};

/** The person's entries of `kind` on `dates`, on every task (debounced; for the overlap checks). */
function useWorkContext(panel, person, kind, dates) {
  const key = [...new Set(dates.filter(Boolean))].sort().join(",");
  const [ctx, setCtx] = useState({ key: "", entries: [] });
  useEffect(() => {
    if (!key) return;
    let live = true;
    const t = setTimeout(async () => {
      const fd = baseForm(panel, person);
      fd.set("kind", kind);
      fd.set("dates", JSON.stringify(key.split(",")));
      const res = await loadWorkContextAction(fd).catch(() => null);
      if (live && res?.ok) setCtx({ key, entries: res.entries });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [panel, person, kind, key]);
  return ctx.entries;
}

const Note = ({ tone, children }) => {
  const t = {
    error: { cls: "bg-danger/10 text-danger", Icon: Ban },
    warning: { cls: "bg-warning/15 text-warning", Icon: AlertTriangle },
    info: { cls: "bg-info/10 text-info", Icon: Info },
  }[tone];
  return (
    <p className={`flex items-start gap-2 rounded-[10px] px-3 py-2 text-xs ${t.cls}`} role={tone === "error" ? "alert" : undefined}>
      <t.Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
};

/** Delete behind the app's confirm modal (the Delete content pattern). */
function DeleteEntry({ panel, person, id, what, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const remove = () =>
    startTransition(async () => {
      const fd = baseForm(panel, person);
      fd.set("id", id);
      const res = await deleteWorkEntryAction(fd);
      if (res?.ok) {
        setOpen(false);
        invalidateTaskPanel();
        toast(`ลบ${what}แล้ว`);
        onDeleted();
      } else toast(res?.error ?? "Something went wrong.", { tone: "error" });
    });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded px-2 text-sm font-semibold text-danger hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
        ลบ
      </button>
      <Modal open={open} onClose={() => setOpen(false)} closeOnBackdrop title={`ลบ${what}?`} description={`${what}นี้จะถูกลบถาวร`}>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary")} data-autofocus>
            ยกเลิก
          </button>
          <button type="button" onClick={remove} disabled={pending} className={buttonClass("danger")}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            ลบ
          </button>
        </div>
      </Modal>
    </>
  );
}

const Footer = ({ left, children }) => (
  <div className="sticky bottom-0 -mx-6 -mb-6 mt-5 flex flex-col gap-3 border-t border-line bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 text-xs text-fg-muted">{left}</div>
    <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
  </div>
);

const hoursOf = (minutes) => String(+(minutes / 60).toFixed(2));

// ── Add / Edit plan ───────────────────────────────────────────────────────

let cardSeq = 0;
const newCard = (date, from = null) => ({
  key: ++cardSeq,
  id: from?.id ?? null,
  date,
  mode: from?.mode ?? "range",
  start: from?.start ?? "",
  end: from?.end ?? "",
  hours: from?.mode === "hours" ? hoursOf(from.minutes) : "",
});

/**
 * @param {{ open: boolean, onClose: () => void, panel: object, person: { id, name }, entry?: object | null,
 *           taskPlans: object[] }} props  taskPlans = this person's saved plans on THIS task
 */
export function PlanDialog({ open, onClose, panel, person, entry = null, taskPlans }) {
  return (
    <Modal open={open} onClose={onClose} title={entry ? "Edit plan" : "Add plan"} description={`${panel.title} · ${person.name}`} size="md">
      <PlanForm panel={panel} person={person} entry={entry} taskPlans={taskPlans} onDone={onClose} />
    </Modal>
  );
}

function PlanForm({ panel, person, entry, taskPlans, onDone }) {
  const wp = panel.workPlan;
  const [cards, setCards] = useState(() => [newCard(entry?.date ?? wp.today, entry)]);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const others = useWorkContext(panel, person.id, "plan", cards.map((c) => c.date));

  const parsed = cards.map((c) => parseEntry(c, { kind: "plan" }));
  const values = parsed.map((p, i) => (p.value ? { ...p.value, ...(cards[i].id ? { id: cards[i].id } : {}) } : null));
  const valid = values.filter(Boolean);
  const planRes = checkPlans(valid, { taskId: panel.id, existing: others, dueDate: wp.dueDate });
  let pk = 0;
  const checks = values.map((v) => (v ? planRes[pk++] : null));

  const touched = (c) => submitted || (c.mode === "range" ? !!(c.start && c.end) : !!c.hours);
  const cardError = (i) => serverErrors[i] ?? checks[i]?.error ?? (touched(cards[i]) ? parsed[i].error : null);
  const blocking = cards.some((_, i) => checks[i]?.error);

  const newMin = valid.reduce((t, v) => t + entryMinutes(v), 0);
  const savedMin = taskPlans.reduce((t, e) => t + entryMinutes(e), 0);
  const grand = savedMin - (entry ? entryMinutes(entry) : 0) + newMin;

  const update = (key, patch) => {
    setServerErrors({});
    setCards((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const save = () => {
    setSubmitted(true);
    setFormError("");
    if (parsed.some((p) => p.error) || blocking) return;
    const fd = baseForm(panel, person.id);
    fd.set(
      "cards",
      JSON.stringify(cards.map((c) => ({ id: c.id ?? undefined, date: c.date, mode: c.mode, start: c.start, end: c.end, hours: c.hours })))
    );
    startTransition(async () => {
      const res = await savePlansAction(fd);
      if (res?.ok) {
        invalidateTaskPanel();
        toast(entry ? "บันทึกแผนแล้ว" : `เพิ่ม ${cards.length} แผนแล้ว`);
        onDone();
      } else {
        setServerErrors(res?.fieldErrors ?? {});
        setFormError(res?.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-[12px] border border-line text-sm">
        <div className="px-3 py-2">
          <p className="text-xs text-fg-muted">Task due date</p>
          <p className="font-semibold text-fg">{wp.dueDate ? formatThaiDay(wp.dueDate, { year: true }) : "–"}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-xs text-fg-muted">วางแผนไว้แล้ว</p>
          <p className="font-semibold text-plan-fg">{formatDuration(savedMin)}</p>
        </div>
      </div>

      {cards.map((c, i) => {
        const v = values[i];
        const ck = checks[i];
        const err = cardError(i);
        // Round 47.1: the past-due note depends on the DATE only — shown before the times are filled.
        const dueWarning = pastDueWarning(pastDueDays(c.date, wp.dueDate));
        const border = err ? "border-danger" : dueWarning ? "border-warning" : "border-line";
        const summary = v
          ? `${formatThaiDay(v.date)} · ${v.mode === "range" ? `${v.start}–${v.end} · ${formatDuration(v.minutes)}` : `${formatDuration(v.minutes)} (ไม่ระบุเวลา)`}`
          : c.date
            ? formatThaiDay(c.date)
            : "";
        const id = `plan-${c.key}`;
        return (
          <section key={c.key} aria-label={`Plan ${i + 1}`} className={`flex flex-col gap-3 rounded-[14px] border-2 p-3.5 ${border}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">
                <span className="font-bold text-fg">Plan {i + 1}</span> <span className="text-xs text-fg-muted">{summary}</span>
              </p>
              {cards.length > 1 && (
                <button
                  type="button"
                  onClick={() => setCards((list) => list.filter((x) => x.key !== c.key))}
                  aria-label={`ลบ Plan ${i + 1}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card-inset hover:text-danger focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-date`} className={label}>วันที่</label>
                <input id={`${id}-date`} type="date" value={c.date} onChange={(e) => update(c.key, { date: e.target.value })} className={input} />
              </div>
              <div>
                <p className={label}>รูปแบบ</p>
                <Segmented
                  name={`${id}-mode`}
                  value={c.mode}
                  onChange={(m) => update(c.key, { mode: m })}
                  options={[
                    { key: "hours", label: "จำนวนชั่วโมง" },
                    { key: "range", label: "ระบุช่วงเวลา" },
                  ]}
                />
              </div>
            </div>
            {c.mode === "range" ? (
              <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
                <div>
                  <label htmlFor={`${id}-start`} className={label}>เริ่ม</label>
                  <TimePicker id={`${id}-start`} value={c.start} onChange={(v) => update(c.key, { start: v })} />
                </div>
                <div>
                  <label htmlFor={`${id}-end`} className={label}>สิ้นสุด</label>
                  <TimePicker id={`${id}-end`} value={c.end} onChange={(v) => update(c.key, { end: v })} />
                </div>
                <span className="mt-8 rounded-full bg-plan-soft px-2.5 py-1 text-xs font-semibold text-plan-fg">
                  {v ? formatDuration(v.minutes) : "–"}
                </span>
              </div>
            ) : (
              <div>
                <label htmlFor={`${id}-hours`} className={label}>จำนวนชั่วโมงที่ตั้งใจทำ</label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-hours`}
                    type="number"
                    min={0.25}
                    max={24}
                    step={0.25}
                    inputMode="decimal"
                    value={c.hours}
                    onChange={(e) => update(c.key, { hours: e.target.value })}
                    className={`${input} max-w-32`}
                  />
                  <span className="text-sm text-fg-muted">ชม.</span>
                  <span className="text-xs text-fg-muted">ทำช่วงไหนของวันก็ได้</span>
                </div>
              </div>
            )}
            {err && <Note tone="error">{err}</Note>}
            {!err && dueWarning && <Note tone="warning">{dueWarning}</Note>}
            {!err && ck?.info && <Note tone="info">{ck.info}</Note>}
          </section>
        );
      })}

      {!entry && cards.length < 31 && (
        <button
          type="button"
          onClick={() => {
            const last = cards.at(-1)?.date || wp.today;
            setCards((list) => [...list, newCard(addDays(last, 1))]);
          }}
          className="flex min-h-11 items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-line text-sm font-semibold text-fg-muted hover:border-brand-500 hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <Plus className="size-4" aria-hidden="true" />
          เพิ่มแผน
        </button>
      )}

      {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
      <Footer
        left={
          <>
            <p>
              {entry ? "แก้ไข 1 แผน" : `กำลังเพิ่ม ${cards.length} แผน`} · {formatDuration(newMin)}
            </p>
            <p>รวมหลังบันทึก {formatDuration(grand)}</p>
          </>
        }
      >
        {entry && <DeleteEntry panel={panel} person={person.id} id={entry.id} what="แผน" onDeleted={onDone} />}
        <button type="button" onClick={onDone} className={buttonClass("outline")}>Cancel</button>
        <button type="button" onClick={save} disabled={pending || blocking} className={buttonClass("primary")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save plan
        </button>
      </Footer>
    </div>
  );
}

// ── Log / Edit time ───────────────────────────────────────────────────────

/**
 * @param {{ open: boolean, onClose: () => void, panel: object, person: { id, name }, entry?: object | null,
 *           date?: string, taskEntries: object[] }} props  taskEntries = this person's plans + logs on THIS task
 */
export function LogDialog({ open, onClose, panel, person, entry = null, date = null, taskEntries }) {
  return (
    <Modal open={open} onClose={onClose} title={entry ? "Edit log" : "Log time"} description={`${panel.title} · ${person.name}`} size="md">
      <LogForm panel={panel} person={person} entry={entry} initialDate={entry?.date ?? date} taskEntries={taskEntries} onDone={onClose} />
    </Modal>
  );
}

let rowSeq = 0;
const newRow = (r = {}) => ({ key: ++rowSeq, start: r.start ?? "", end: r.end ?? "" });

function LogForm({ panel, person, entry, initialDate, taskEntries, onDone }) {
  const today = panel.workPlan.today;
  const [date, setDate] = useState(initialDate && initialDate <= today ? initialDate : today);
  const [mode, setMode] = useState(entry?.mode ?? "range");
  const [rows, setRows] = useState(() => [newRow(entry?.mode === "range" ? entry : {})]);
  const [hours, setHours] = useState(entry?.mode === "hours" ? hoursOf(entry.minutes) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const others = useWorkContext(panel, person.id, "log", [date]);

  const raws = mode === "hours" ? [{ date, mode, hours }] : rows.map((r) => ({ date, mode, start: r.start, end: r.end }));
  const parsed = raws.map((r) => parseEntry(r, { kind: "log", today }));
  const values = parsed.map((p) => (p.value ? { ...p.value, ...(entry ? { id: entry.id } : {}) } : null));
  const valid = values.filter(Boolean);
  const logRes = checkLogs(valid, { existing: others });
  let lk = 0;
  const overlapErrors = values.map((v) => (v ? logRes[lk++] : null));

  const dateError = serverErrors.date ?? (date > today ? "บันทึกเวลาของวันในอนาคตไม่ได้" : null);
  const touched = (i) => submitted || (mode === "hours" ? !!hours : !!(rows[i]?.start && rows[i]?.end));
  const rowError = (i) => serverErrors[mode === "hours" ? "hours" : i] ?? overlapErrors[i] ?? (touched(i) && parsed[i].field !== "date" ? parsed[i].error : null);
  const blocking = overlapErrors.some(Boolean) || !!dateError;

  // Compare with this task's plan of the day (this person).
  const dayPlans = taskEntries.filter((e) => e.kind === "plan" && e.date === date);
  const dayLogs = taskEntries.filter((e) => e.kind === "log" && e.date === date && e.id !== entry?.id);
  const oldMin = dayLogs.reduce((t, e) => t + entryMinutes(e), 0);
  const newMin = valid.reduce((t, v) => t + entryMinutes(v), 0);
  const day = daySummary(dayPlans, [...dayLogs, ...valid]);

  const save = () => {
    setSubmitted(true);
    setFormError("");
    if (parsed.some((p) => p.error) || blocking) return;
    const fd = baseForm(panel, person.id);
    if (entry) fd.set("id", entry.id);
    fd.set("date", date);
    fd.set("mode", mode);
    fd.set("rows", JSON.stringify(rows.map((r) => ({ start: r.start, end: r.end }))));
    fd.set("hours", hours);
    fd.set("note", note);
    startTransition(async () => {
      const res = await saveLogsAction(fd);
      if (res?.ok) {
        invalidateTaskPanel();
        toast(entry ? "บันทึกแล้ว" : "บันทึกเวลาแล้ว");
        onDone();
      } else {
        setServerErrors(res?.fieldErrors ?? {});
        setFormError(res?.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="log-date" className={label}>วันที่ทำงาน</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="log-date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => {
              setServerErrors({});
              setDate(e.target.value);
            }}
            className={`${input} max-w-48`}
            aria-invalid={!!dateError || undefined}
            aria-describedby="log-date-error"
          />
          <span className="text-sm text-fg">
            {formatThaiDay(date, { year: true })}
            {date === today && <span className="text-accent-fg"> · วันนี้</span>}
          </span>
        </div>
        {dateError && <p id="log-date-error" role="alert" className="mt-1.5 text-xs text-danger">{dateError}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <p className={label}>เวลาที่ทำจริง</p>
        <Segmented
          name="log-mode"
          value={mode}
          onChange={(m) => {
            setServerErrors({});
            setMode(m);
          }}
          options={[
            { key: "range", label: "เวลาเริ่ม–สิ้นสุด" },
            { key: "hours", label: "เฉพาะจำนวนชั่วโมง" },
          ]}
        />
        {mode === "range" ? (
          <>
            {rows.map((r, i) => {
              const err = rowError(i);
              const v = values[i];
              return (
                <div key={r.key}>
                  <div className="grid grid-cols-[1fr_1fr_6.5rem_auto] items-start gap-2">
                    <TimePicker
                      id={`log-${r.key}-start`}
                      ariaLabel={`เริ่ม ช่วงที่ ${i + 1}`}
                      value={r.start}
                      onChange={(v) => {
                        setServerErrors({});
                        setRows((list) => list.map((x) => (x.key === r.key ? { ...x, start: v } : x)));
                      }}
                      invalid={!!err}
                    />
                    <TimePicker
                      id={`log-${r.key}-end`}
                      ariaLabel={`สิ้นสุด ช่วงที่ ${i + 1}`}
                      value={r.end}
                      onChange={(v) => {
                        setServerErrors({});
                        setRows((list) => list.map((x) => (x.key === r.key ? { ...x, end: v } : x)));
                      }}
                      invalid={!!err}
                    />
                    <span className="pt-2.5 text-right text-sm font-semibold text-accent-fg">{v ? formatDuration(v.minutes) : "–"}</span>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                        aria-label={`ลบช่วงที่ ${i + 1}`}
                        className="mt-1.5 flex size-8 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card-inset hover:text-danger focus-visible:outline-2 focus-visible:outline-brand-500"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="size-8" />
                    )}
                  </div>
                  {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
                </div>
              );
            })}
            {!entry && rows.length < 12 && (
              <button
                type="button"
                onClick={() => setRows((list) => [...list, newRow()])}
                className="self-start rounded text-sm font-semibold text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                + เพิ่มช่วงเวลา
              </button>
            )}
          </>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                aria-label="จำนวนชั่วโมง"
                min={0.25}
                max={24}
                step={0.25}
                inputMode="decimal"
                value={hours}
                onChange={(e) => {
                  setServerErrors({});
                  setHours(e.target.value);
                }}
                className={`${input} max-w-32`}
                aria-invalid={!!rowError(0) || undefined}
              />
              <span className="text-sm text-fg-muted">ชม.</span>
            </div>
            {rowError(0) && <p role="alert" className="mt-1 text-xs text-danger">{rowError(0)}</p>}
          </div>
        )}
      </div>

      <div>
        <p className={label}>เทียบกับแผนของวันนี้</p>
        <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-[12px] border border-line text-sm">
          <div className="px-3 py-2">
            <p className="text-xs text-fg-muted">แผนทั้งวัน</p>
            <p className="font-semibold text-plan-fg">{day.plannedMin ? formatDuration(day.plannedMin) : "–"}</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-xs text-fg-muted">ทำจริงทั้งวัน</p>
            <p className="font-semibold text-accent-fg">{day.actualMin ? formatDuration(day.actualMin) : "–"}</p>
            <p className="text-[11px] text-fg-muted">
              เดิม {formatDuration(oldMin)} + ใหม่ {formatDuration(newMin)}
            </p>
          </div>
          <div className="px-3 py-2">
            <p className="text-xs text-fg-muted">เกินแผน</p>
            <p className="font-semibold">
              {!dayPlans.length ? (
                <span className="text-plan-fg">นอกแผน</span>
              ) : day.overMin ? (
                <span className="text-success">{formatOver(day.overMin)}</span>
              ) : (
                "–"
              )}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="log-note" className={label}>Work note (ไม่บังคับ)</label>
        <textarea id="log-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${input} resize-y`} />
        {serverErrors.note && <p role="alert" className="mt-1 text-xs text-danger">{serverErrors.note}</p>}
      </div>

      {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
      <Footer left="บันทึกลงวันที่เลือก ไม่เปลี่ยนแผนหรือ Task Status">
        {entry && <DeleteEntry panel={panel} person={person.id} id={entry.id} what="เวลาที่บันทึก" onDeleted={onDone} />}
        <button type="button" onClick={onDone} className={buttonClass("outline")}>Cancel</button>
        <button type="button" onClick={save} disabled={pending || blocking} className={buttonClass("primary")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
      </Footer>
    </div>
  );
}
