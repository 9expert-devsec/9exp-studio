"use client";

// Task Detail → Work Plan (round 47, Figma 309:312). Planned vs Actual per day for
// ONE selected person (the task's Work Plan people: lib/tasks/workplan.js
// workPlanPeople). Every number and label comes from lib/tasks/workplan.js
// (summaryCards, buildRows, daySummary, rowLabel, formatDuration) — the same
// module the server actions use. Data: lib/tasks/workplanStore.js loadWorkPlan
// (panel.workPlan). Writers (the person, or Manager / superadmin on behalf) get
// Log time / + Add plan / Edit; everyone else reads.
// Hours-only entries: a plan draws as a dashed outline across the whole Plan
// lane; a log as a semi-transparent orange stub at the LEFT of the Actual lane,
// its width to scale. Blocks are at least MIN_BLOCK_PX wide (left edge = true
// time); expanded-row labels never overlap (layoutLaneLabels, round 47.1).

import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronDown, ChevronRight, Clock, Plus } from "lucide-react";
import { LogDialog, PlanDialog } from "@/components/tasks/WorkPlanDialogs";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { input, label } from "@/components/projects/ProjectForm";
import { formatThaiDay } from "@/lib/projects/format";
import {
  DAY_MIN,
  MIN_BLOCK_PX,
  buildRows,
  defaultRange,
  entryLabel,
  formatDuration,
  formatOver,
  layoutLaneLabels,
  summaryCards,
  toMin,
} from "@/lib/tasks/workplan";

const LABEL_TONE = {
  today: "text-accent-fg",
  due: "text-danger",
  late: "text-danger",
  offplan: "text-plan-fg",
  moved: "text-fg-muted",
  hours: "text-fg-muted",
};
const pct = (min) => `${(min / DAY_MIN) * 100}%`;
const dur = (min, compact = false) => (min ? formatDuration(min, { compact }) : "–");

export default function WorkPlanTab({ panel }) {
  const wp = panel.workPlan;
  const [personId, setPersonId] = useState(wp.defaultPerson);
  const person = wp.people.find((p) => p.id === personId) ?? wp.people[0] ?? null;
  const mine = wp.entries.filter((e) => e.person === person?.id);
  const plans = mine.filter((e) => e.kind === "plan");
  const logs = mine.filter((e) => e.kind === "log");
  // null = the default range for this person (recomputed when data changes).
  const [range, setRange] = useState(null);
  const auto = defaultRange({ startDate: wp.startDate, dueDate: wp.dueDate, entries: mine, today: wp.today });
  const { from, to } = range ?? auto;
  const [dialog, setDialog] = useState(null); // { kind: "plan"|"log", entry?, date? }
  const canWrite = !!person && wp.writable.includes(person.id);

  if (!person) {
    return <p className="rounded-[12px] bg-card-inset py-10 text-center text-sm text-fg-muted">ยังไม่มีผู้รับผิดชอบสำหรับ Work Plan ของ Task นี้</p>;
  }
  const rows = buildRows(plans, logs, { from, to, today: wp.today, dueDate: wp.dueDate });
  const sum = summaryCards(plans, logs, { from, to, today: wp.today });
  const actualSub = [sum.offPlanMin ? `รวมนอกแผน ${formatDuration(sum.offPlanMin)}` : "", sum.mustLogDays ? `ต้องบันทึก ${sum.mustLogDays} วัน` : ""]
    .filter(Boolean)
    .join(" · ");
  const openLog = (date = null, entry = null) => setDialog({ kind: "log", date, entry });
  const openPlan = (entry = null) => setDialog({ kind: "plan", entry });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold text-fg">Work Plan</h4>
          <p className="text-xs text-fg-muted">เทียบ Planned กับ Actual รายวัน</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wp.people.length > 1 && (
            <label className="flex items-center gap-2 rounded-[12px] border border-line px-2 py-1">
              <Avatar name={person.name} url={person.avatarUrl} size={22} />
              <span className="sr-only">คน</span>
              <select
                value={person.id}
                onChange={(e) => {
                  setPersonId(e.target.value);
                  setRange(null);
                }}
                className="min-h-8 bg-transparent pr-1 text-sm text-fg outline-none"
              >
                {wp.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <RangePicker from={from} to={to} onChange={setRange} onReset={() => setRange(null)} />
          {canWrite && (
            <>
              <button type="button" onClick={() => openLog()} className={buttonClass("outline", "min-h-9")}>
                <Clock className="size-4" aria-hidden="true" />
                Log time
              </button>
              <button type="button" onClick={() => openPlan()} className={buttonClass("primary", "min-h-9")}>
                <Plus className="size-4" aria-hidden="true" />
                Add plan
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] bg-plan-soft p-3.5">
          <p className="text-xs text-fg-muted">Planned Time</p>
          <p className="mt-1 text-2xl font-bold text-plan-fg">{formatDuration(sum.plannedMin)}</p>
          <p className="text-xs text-fg-muted">
            {sum.planDays} วัน · {sum.planEntries} ช่วงเวลา
          </p>
        </div>
        <div className="rounded-[14px] bg-accent-soft p-3.5">
          <p className="text-xs text-fg-muted">Actual Time</p>
          <p className="mt-1 text-2xl font-bold text-accent-fg">{formatDuration(sum.actualMin)}</p>
          <p className="text-xs text-fg-muted">{actualSub || " "}</p>
        </div>
      </div>

      {plans.length === 0 && logs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[12px] bg-card-inset py-10 text-center">
          <p className="text-sm text-fg-muted">ยังไม่มีแผนหรือเวลาที่บันทึก</p>
          {canWrite && (
            <div className="flex gap-2">
              <button type="button" onClick={() => openLog()} className={buttonClass("outline", "min-h-9")}>Log time</button>
              <button type="button" onClick={() => openPlan()} className={buttonClass("primary", "min-h-9")}>+ Add plan</button>
            </div>
          )}
        </div>
      ) : (
        <DayTable
          rows={rows}
          today={wp.today}
          // Round 47.1: a range across calendar years shows the year on every row date.
          withYear={from.slice(0, 4) !== to.slice(0, 4)}
          canWrite={canWrite}
          onLog={openLog}
          onEditPlan={openPlan}
          onEditLog={(e) => openLog(e.date, e)}
        />
      )}

      {dialog?.kind === "plan" && (
        <PlanDialog open onClose={() => setDialog(null)} panel={panel} person={person} entry={dialog.entry} taskPlans={plans} />
      )}
      {dialog?.kind === "log" && (
        <LogDialog open onClose={() => setDialog(null)} panel={panel} person={person} entry={dialog.entry} date={dialog.date} taskEntries={mine} />
      )}
    </div>
  );
}

function RangePicker({ from, to, onChange, onReset }) {
  const [open, setOpen] = useState(false);
  const text = `${formatThaiDay(from, { weekday: false })} – ${formatThaiDay(to, { weekday: false, year: true })}`;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-9 items-center gap-2 rounded-[12px] border border-line px-3 text-sm text-fg hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <CalendarRange className="size-4 text-fg-muted" aria-hidden="true" />
        {text}
        <ChevronDown className="size-4 text-fg-muted" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-3 rounded-[14px] border border-line bg-card p-3 shadow-xl">
          <div>
            <label htmlFor="wp-from" className={label}>ตั้งแต่</label>
            <input id="wp-from" type="date" value={from} max={to} onChange={(e) => e.target.value && onChange({ from: e.target.value, to })} className={input} />
          </div>
          <div>
            <label htmlFor="wp-to" className={label}>ถึง</label>
            <input id="wp-to" type="date" value={to} min={from} onChange={(e) => e.target.value && onChange({ from, to: e.target.value })} className={input} />
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={onReset} className="rounded text-sm text-fg-muted hover:text-fg hover:underline">ค่าเริ่มต้น</button>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary", "min-h-8")}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bars ──────────────────────────────────────────────────────────────────

/** Block left + width: true start time; at least MIN_BLOCK_PX wide so a short block never shrinks to a dot. */
const blockStyle = (startMin, minutes) => ({ left: pct(startMin), width: `max(${MIN_BLOCK_PX}px, ${pct(minutes)})` });

/** The element's width in px (ResizeObserver); 0 until measured. */
function useWidth(ref, active) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, active]);
  return width;
}

const LINE_PX = 14;

/**
 * One lane of blocks (Plan = lavender, Actual = orange). `labels` (expanded row):
 * range labels under the blocks, laid out by lib/tasks/workplan.js
 * layoutLaneLabels — left to right, a second line when they'd overlap, hidden
 * when neither line has room (the block's tooltip still shows the range).
 */
function Lane({ entries, kind, thin, labels = false }) {
  const fill = kind === "plan" ? "bg-plan" : "bg-brand-500";
  const h = thin ? "h-1.5" : "h-4";
  const ref = useRef(null);
  const width = useWidth(ref, labels);
  const placed = labels && width ? layoutLaneLabels(entries, width) : [];
  const lines = placed.reduce((n, l) => (l.line == null ? n : Math.max(n, l.line + 1)), 0);
  return (
    <div ref={ref} className="relative">
      <div className={`relative ${h}`}>
        {entries.map((e) => {
          if (e.mode === "hours") {
            return kind === "plan" ? (
              <span key={e.id} className="absolute inset-y-0 left-0 right-0 rounded-[4px] border border-dashed border-plan" title={entryLabel(e)} />
            ) : (
              <span key={e.id} className={`absolute inset-y-0 rounded-[4px] ${fill} opacity-50`} style={blockStyle(0, e.minutes)} title={entryLabel(e)} />
            );
          }
          const s = toMin(e.start);
          return <span key={e.id} className={`absolute inset-y-0 rounded-[4px] ${fill}`} style={blockStyle(s, toMin(e.end) - s)} title={entryLabel(e)} />;
        })}
      </div>
      {labels && (
        <div aria-hidden="true" className="relative mt-0.5" style={{ height: Math.max(lines, 1) * LINE_PX }}>
          {placed
            .filter((l) => l.line != null)
            .map((l) => (
              <span key={l.id} className="absolute whitespace-nowrap text-[10px] leading-[14px] text-fg-muted" style={{ left: l.x, top: l.line * LINE_PX }}>
                {l.text}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

const Grid = ({ every }) => (
  <>
    {Array.from({ length: 24 / every - 1 }, (_, i) => (
      <span key={i} aria-hidden="true" className="absolute inset-y-0 w-px bg-line" style={{ left: pct((i + 1) * every * 60) }} />
    ))}
  </>
);

function MiniBar({ row }) {
  return (
    <div className="relative flex h-7 flex-col justify-center gap-1 overflow-hidden rounded-full bg-track/60 px-0" aria-hidden="true">
      <Grid every={6} />
      <Lane entries={row.plans} kind="plan" thin />
      <Lane entries={row.logs} kind="log" thin />
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────

const COLS = "grid grid-cols-[8.5rem_minmax(8rem,1fr)_4.5rem_4.5rem_5.5rem] items-center gap-3";

function DayTable({ rows, today, withYear, canWrite, onLog, onEditPlan, onEditLog }) {
  const [open, setOpen] = useState(() => new Set([today]));
  const toggle = (d) => setOpen((s) => (s.has(d) ? new Set([...s].filter((x) => x !== d)) : new Set([...s, d])));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[34rem]">
        <div aria-hidden="true" className={`${COLS} border-b border-line px-3 pb-2 text-xs font-semibold text-fg-muted`}>
          <span>วันที่</span>
          <span>เวลา 00–24 น. (Planned vs Actual)</span>
          <span className="text-right">Planned</span>
          <span className="text-right">Actual</span>
          <span className="text-right">เกินแผน</span>
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          {rows.map((r) => (
            <DayRow
              key={r.date}
              row={r}
              isToday={r.date === today}
              withYear={withYear}
              expanded={open.has(r.date)}
              onToggle={() => toggle(r.date)}
              canWrite={canWrite}
              onLog={onLog}
              onEditPlan={onEditPlan}
              onEditLog={onEditLog}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const OverPill = ({ min }) =>
  min ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{formatOver(min)}</span> : <span className="text-fg-muted">–</span>;

function DayRow({ row, isToday, withYear, expanded, onToggle, canWrite, onLog, onEditPlan, onEditLog }) {
  const valTone = isToday ? "text-accent-fg" : "text-fg";
  const panelId = `wp-day-${row.date}`;
  return (
    <div className={`rounded-[12px] border ${isToday ? "border-brand-500 bg-accent-soft/40" : "border-line"}`}>
      <div className={`${COLS} px-3 py-2`}>
        <span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="flex items-start gap-1.5 rounded text-left focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ChevronRight className={`mt-0.5 size-4 shrink-0 text-fg-muted transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true" />
            <span>
              <span className="block text-sm font-bold text-fg">{formatThaiDay(row.date, { year: withYear })}</span>
              {row.label && <span className={`block text-[11px] font-semibold ${LABEL_TONE[row.label.key]}`}>{row.label.text}</span>}
            </span>
          </button>
        </span>
        <span>
          <MiniBar row={row} />
        </span>
        <span className={`text-right text-sm ${valTone}`}>
          <span className="sr-only">Planned </span>
          {dur(row.plannedMin, true)}
        </span>
        <span className={`text-right text-sm ${valTone}`}>
          <span className="sr-only">Actual </span>
          {dur(row.actualMin, true)}
        </span>
        <span className="text-right">
          <OverPill min={row.overMin} />
        </span>
      </div>
      {expanded && (
        <div id={panelId} className="grid gap-4 border-t border-line-subtle px-3 py-3 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <div className="rounded-[10px] bg-plan-soft px-3 py-2">
              <p className="text-[11px] text-fg-muted">Planned</p>
              <p className="text-sm font-bold text-plan-fg">{dur(row.plannedMin)}</p>
            </div>
            <div className="rounded-[10px] bg-accent-soft px-3 py-2">
              <p className="text-[11px] text-fg-muted">Actual</p>
              <p className="text-sm font-bold text-accent-fg">{dur(row.actualMin)}</p>
            </div>
            <div className="rounded-[10px] border border-line px-3 py-2">
              <p className="text-[11px] text-fg-muted">เกินแผน</p>
              <p className="text-sm font-bold text-success">{row.overMin ? formatOver(row.overMin) : <span className="text-fg-muted">–</span>}</p>
            </div>
            {canWrite && (
              <button type="button" onClick={() => onLog(row.date)} className={buttonClass("primary", "min-h-9 w-full")}>
                <Clock className="size-4" aria-hidden="true" />
                Log time
              </button>
            )}
          </div>
          <div className="min-w-0">
            <p className="flex gap-4 text-xs text-fg-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-plan" aria-hidden="true" />
                Plan (แผน)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-500" aria-hidden="true" />
                Actual (ทำจริง)
              </span>
            </p>
            <div className="relative mt-2 flex flex-col gap-1 rounded-[10px] bg-card-inset px-1 py-2">
              <Grid every={3} />
              <Lane entries={row.plans} kind="plan" labels />
              <Lane entries={row.logs} kind="log" labels />
            </div>
            <div className="relative mt-1 h-4 text-[10px] text-fg-muted" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(i * 180) }}>
                  {String(i * 3).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-line-subtle text-sm">
              {row.plans.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-plan-fg">แผน · {entryLabel(e)}</span>
                  {canWrite && <EditLink onClick={() => onEditPlan(e)} />}
                </li>
              ))}
              {row.logs.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 text-fg">
                    <span className="text-accent-fg">{entryLabel(e)}</span>
                    {e.note && <span className="text-fg-muted"> · {e.note}</span>}
                  </span>
                  {canWrite && <EditLink onClick={() => onEditLog(e)} />}
                </li>
              ))}
              {!row.plans.length && !row.logs.length && <li className="py-1.5 text-fg-muted">ยังไม่มีแผนหรือเวลาที่บันทึกในวันนี้</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const EditLink = ({ onClick }) => (
  <button type="button" onClick={onClick} className="shrink-0 rounded text-xs font-semibold text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
    Edit
  </button>
);
