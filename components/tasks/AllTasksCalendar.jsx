"use client";

// All Tasks calendar (round 57, Figma 386:3700 month / 386:3991 week).
// Data: lib/tasks/allTasks.js loadAllTasksCalendar (every task that draws
// something in the range). Layout rules are pure: lib/tasks/calendar.js.
// State is the URL (view=calendar, cal, date, dueOnly) — read from `f`, never
// copied; the only local state is which "+N งาน" popover is open.
// Every bar / pill / list row is a TaskOpenLink → the Task Detail drawer on this
// page (?task=<id>); closing it leaves the calendar URL as it was.

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import TaskOpenLink from "@/components/tasks/TaskOpenLink";
import Avatar from "@/components/ui/Avatar";
import { cardClass } from "@/components/ui/Card";
import { ALL_TASKS_PATH, allTasksQuery } from "@/lib/tasks/allTasksFilters";
import {
  MONTH_LANES,
  THAI_DAY_ABBR,
  barSpan,
  clipSpan,
  colOf,
  layoutLanes,
  monthRange,
  monthTitle,
  overdueSpan,
  shiftAnchor,
  weekBarLabel,
  weekOrder,
  weekRange,
  weekTitle,
} from "@/lib/tasks/calendar";
import { taskTypeTone } from "@/lib/tasks/types";
import { TypeBadge } from "./AllTasksTable";
import { CARD_FILL, SCROLLER, STICKY_HEAD } from "./allTasksStyles";

const href = (f, changes) => `${ALL_TASKS_PATH}${allTasksQuery(f, changes)}`;
const navBtn =
  "inline-flex size-9 items-center justify-center rounded-[10px] border border-line bg-card text-fg hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-brand-500";
const seg = "inline-flex min-h-8 items-center rounded-[9px] px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-500";
const isDone = (t) => t.stage === "done";

/** @param {{ f: object, data: object }} props */
export default function AllTasksCalendar({ f, data }) {
  const month = f.cal === "month";
  return (
    <>
      <CalendarBar f={f} data={data} month={month} />
      {data.truncated && (
        <p className="flex shrink-0 items-center gap-2 text-xs text-warning">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          แสดง {data.tasks.length} งานแรกในช่วงนี้ — ใช้ตัวกรองเพื่อจำกัดผลลัพธ์
        </p>
      )}
      {month ? <MonthView f={f} data={data} /> : <WeekView data={data} />}
    </>
  );
}

// ── Header: ‹ › title วันนี้ · แสดงเฉพาะ Due (month) · เดือน | สัปดาห์ ──────────

function CalendarBar({ f, data, month }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const title = month ? monthTitle(data.anchor) : weekTitle(data.anchor);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Link href={href(f, { date: shiftAnchor(data.anchor, f.cal, -1) })} scroll={false} aria-label={month ? "เดือนก่อน" : "สัปดาห์ก่อน"} className={navBtn}>
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>
      <Link href={href(f, { date: shiftAnchor(data.anchor, f.cal, 1) })} scroll={false} aria-label={month ? "เดือนถัดไป" : "สัปดาห์ถัดไป"} className={navBtn}>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
      <h2 aria-live="polite" className="mx-1 min-w-0 text-lg font-bold text-fg">
        {title}
      </h2>
      <Link href={href(f, { date: "" })} scroll={false} className={`${navBtn} w-auto px-3 text-sm font-medium`}>
        วันนี้
      </Link>

      <div className="ml-auto flex items-center gap-3">
        {month && (
          <button
            type="button"
            role="switch"
            aria-checked={f.dueOnly}
            onClick={() => startTransition(() => router.replace(href(f, { dueOnly: !f.dueOnly }), { scroll: false }))}
            className="inline-flex items-center gap-2 rounded-full text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <span aria-hidden="true" className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${f.dueOnly ? "bg-brand-500" : "bg-track"}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-card shadow transition-all ${f.dueOnly ? "left-[18px]" : "left-0.5"}`} />
            </span>
            แสดงเฉพาะ Due
          </button>
        )}
        <div role="group" aria-label="ช่วงเวลา" className="inline-flex gap-0.5 rounded-[12px] border border-control-line bg-control p-0.5">
          {[
            ["month", "เดือน"],
            ["week", "สัปดาห์"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={href(f, { cal: key })}
              scroll={false}
              aria-current={f.cal === key ? "true" : undefined}
              className={`${seg} ${f.cal === key ? "bg-card font-semibold text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** A task bar piece (type colour; faded when done; ‹ › on a cut edge). */
function BarPiece({ task, clip, style, children }) {
  return (
    <TaskOpenLink
      taskId={task.id}
      href={task.openHref}
      title={`${task.title} · ${task.statusLabel}`}
      style={style}
      className={`relative z-[6] flex h-5 min-w-0 items-center gap-1 self-center overflow-hidden rounded-[6px] px-1.5 text-[11px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-brand-500 ${taskTypeTone(task.type)} ${
        isDone(task) ? "opacity-45" : ""
      } ${clip.cutStart ? "rounded-l-none" : "ml-0.5"} ${clip.cutEnd ? "rounded-r-none" : "mr-0.5"}`}
    >
      {clip.cutStart && <ChevronLeft className="size-3 shrink-0" aria-label="ต่อจากก่อนหน้า" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {clip.cutEnd && <ChevronRight className="size-3 shrink-0" aria-label="ต่อไป" />}
    </TaskOpenLink>
  );
}

/** The dashed overdue segment "เลย N วัน". */
function OverduePiece({ task, clip, style }) {
  return (
    <TaskOpenLink
      taskId={task.id}
      href={task.openHref}
      title={`${task.title} · เลย ${clip.days} วัน`}
      style={style}
      className={`relative z-[6] flex h-5 min-w-0 items-center self-center overflow-hidden border border-dashed border-danger bg-danger/10 px-1.5 text-[11px] font-semibold text-danger outline-none focus-visible:outline-2 focus-visible:outline-brand-500 ${
        clip.cutStart ? "border-l-0" : "rounded-l-[6px]"
      } ${clip.cutEnd ? "border-r-0" : "mr-0.5 rounded-r-[6px]"}`}
    >
      <span className="truncate">เลย {clip.days} วัน</span>
    </TaskOpenLink>
  );
}

/** A point event: dot + pill on its day. */
function PointPill({ task, point, withTitle, style }) {
  return (
    <TaskOpenLink
      taskId={task.id}
      href={task.openHref}
      title={`${task.title} · ${point.label}`}
      style={style}
      className={`relative z-[7] mx-0.5 flex h-5 min-w-0 items-center gap-1 self-center overflow-hidden rounded-full px-1.5 text-[11px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-brand-500 ${taskTypeTone(task.type)} ${
        isDone(task) ? "opacity-60" : ""
      }`}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{withTitle ? `${task.title} · ${point.label}` : point.label}</span>
    </TaskOpenLink>
  );
}

/** The drawable items of a task: its bar (+ overdue, one lane) and its point events. */
function taskItems(task, todayKey, dueOnly) {
  const bar = barSpan(task);
  const od = dueOnly ? null : overdueSpan(task, todayKey);
  const out = [];
  if (bar || od) {
    const start = bar?.start ?? od.start;
    const end = od && (!bar || od.end > bar.end) ? od.end : bar.end;
    out.push({ id: task.id, kind: "task", task, bar, od, start, end });
  }
  task.points.forEach((p, i) => out.push({ id: `${task.id}:p${i}`, kind: "point", task, point: p, start: p.day, end: p.day }));
  return out;
}

// ── Month ───────────────────────────────────────────────────────────────────

function MonthView({ f, data }) {
  const grid = monthRange(data.anchor);
  const items = data.tasks.flatMap((t) => taskItems(t, data.todayKey, f.dueOnly));
  return (
    <div className={`${cardClass({ size: "sm", padded: false })} ${CARD_FILL}`}>
      <div className={SCROLLER}>
        <div className={`${STICKY_HEAD} grid min-w-[760px] grid-cols-7`}>
          {THAI_DAY_ABBR.map((d) => (
            <div key={d} className="px-3 py-2 text-xs font-medium text-fg-muted">
              {d}
            </div>
          ))}
        </div>
        <div className="min-w-[760px]">
          {grid.weeks.map((week) => (
            <MonthWeek key={week[0]} week={week} month={grid.month} items={items} todayKey={data.todayKey} />
          ))}
        </div>
      </div>
    </div>
  );
}

const MONTH_ROWS = `28px repeat(${MONTH_LANES}, 24px) 22px`;

function MonthWeek({ week, month, items, todayKey }) {
  const { placed, hidden } = layoutLanes(items, week);
  const [openDay, setOpenDay] = useState(null);
  return (
    <div className="relative grid grid-cols-7 border-b border-line-subtle last:border-0" style={{ gridTemplateRows: MONTH_ROWS }}>
      {/* Day cells (background + date number) */}
      {week.map((day, i) => {
        const outside = day.slice(0, 7) !== month;
        const today = day === todayKey;
        return (
          <div
            key={day}
            style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
            className={`border-line-subtle ${i ? "border-l" : ""} ${outside ? "bg-card-inset/50" : ""}`}
          >
            <span
              className={`ml-2 mt-1.5 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
                today ? "bg-brand-500 font-semibold text-navy" : outside ? "text-fg-muted/60" : "text-fg"
              }`}
            >
              {Number(day.slice(8))}
            </span>
          </div>
        );
      })}

      {placed
        .filter((p) => p.lane < MONTH_LANES)
        .flatMap((p) => {
          const row = p.lane + 2;
          if (p.kind === "point") {
            return [<PointPill key={p.id} task={p.task} point={p.point} withTitle style={{ gridColumn: colOf(p.s, week[0]) + 1, gridRow: row }} />];
          }
          const out = [];
          const bar = clipSpan(p.bar, week[0], week[6]);
          const od = clipSpan(p.od, week[0], week[6]);
          const place = (c) => ({ gridColumn: `${colOf(c.start, week[0]) + 1} / span ${colOf(c.end, c.start) + 1}`, gridRow: row });
          if (bar)
            out.push(
              <BarPiece key={`${p.id}:b`} task={p.task} clip={bar} style={place(bar)}>
                {p.task.title}
              </BarPiece>
            );
          if (od) out.push(<OverduePiece key={`${p.id}:o`} task={p.task} clip={od} style={place(od)} />);
          return out;
        })}

      {/* "+N งาน" per day, with a popover of that day's tasks */}
      {week.map((day, i) =>
        hidden[i] > 0 ? (
          <div key={`more-${day}`} className="relative z-[8] self-center px-1.5" style={{ gridColumn: i + 1, gridRow: MONTH_LANES + 2 }}>
            <button
              type="button"
              aria-expanded={openDay === day}
              onClick={() => setOpenDay(openDay === day ? null : day)}
              className="rounded px-1 text-[11px] font-medium text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              +{hidden[i]} งาน
            </button>
            {openDay === day && <DayPopover day={day} placed={placed} onClose={() => setOpenDay(null)} />}
          </div>
        ) : null
      )}
    </div>
  );
}

/** Every task touching `day` (visible lanes too); a click opens Task Detail. */
function DayPopover({ day, placed, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => !ref.current?.contains(e.target) && !e.target.closest?.("[aria-expanded]") && onClose();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector("a")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const seen = new Set();
  const list = placed
    .filter((p) => p.s <= day && p.e >= day)
    .filter((p) => (seen.has(p.task.id) ? false : seen.add(p.task.id)));
  return (
    <div ref={ref} role="dialog" aria-label={`งานวันที่ ${Number(day.slice(8))}`} className="absolute left-0 top-full z-30 mt-1 w-64 rounded-[14px] border border-line bg-card p-1.5 shadow-xl">
      <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto app-scrollbar">
        {list.map((p) => (
          <li key={p.task.id}>
            <TaskOpenLink
              taskId={p.task.id}
              href={p.task.openHref}
              className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm text-fg outline-none hover:bg-card-inset focus-visible:bg-card-inset"
            >
              <TypeBadge type={p.task.type} label={p.task.typeLabel} />
              <span className={`min-w-0 truncate ${isDone(p.task) ? "opacity-60" : ""}`}>{p.task.title}</span>
            </TaskOpenLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Week ────────────────────────────────────────────────────────────────────

const WEEK_COLS = "grid-cols-[minmax(240px,300px)_repeat(7,minmax(104px,1fr))]";

function WeekView({ data }) {
  const { start, days } = weekRange(data.anchor);
  const tasks = weekOrder(data.tasks, data.todayKey);
  const todayCol = days.indexOf(data.todayKey);
  const tint = "bg-accent-soft/40";
  return (
    <div className={`${cardClass({ size: "sm", padded: false })} ${CARD_FILL}`}>
      <div className={SCROLLER}>
        <div className={`grid min-w-[1000px] ${WEEK_COLS}`} style={{ gridAutoRows: "minmax(60px, auto)" }}>
          {/* Header row (sticky); the corner is sticky both ways. */}
          <div style={{ gridColumn: 1, gridRow: 1 }} className={`${STICKY_HEAD} left-0 z-20 flex items-center px-4 text-xs text-fg-muted`}>
            งาน ({tasks.length}) · เรียงตาม เลยกำหนด → ใกล้ Due
          </div>
          {days.map((d, i) => (
            // Opaque sticky cell; today's tint is an inner layer (accent-soft may be translucent).
            <div key={d} style={{ gridColumn: i + 2, gridRow: 1 }} className={`${STICKY_HEAD} border-l border-line-subtle`}>
              <div className={`h-full px-3 py-2 ${i === todayCol ? tint : ""}`}>
                <p className={`text-xs ${i === todayCol ? "font-semibold text-accent-fg" : "text-fg-muted"}`}>{THAI_DAY_ABBR[i]}</p>
                <p className="mt-0.5">
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                      i === todayCol ? "bg-brand-500 text-navy" : "text-fg"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                </p>
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <p style={{ gridColumn: "1 / -1", gridRow: 2 }} className="py-12 text-center text-sm text-fg-muted">
              ไม่มีงานในสัปดาห์นี้
            </p>
          )}

          {tasks.map((t, r) => {
            const row = r + 2;
            const bar = clipSpan(barSpan(t), days[0], days[6]);
            const od = clipSpan(overdueSpan(t, data.todayKey), days[0], days[6]);
            const place = (c) => ({ gridColumn: `${colOf(c.start, start) + 2} / span ${colOf(c.end, c.start) + 1}`, gridRow: row });
            return [
              <div key={`${t.id}:l`} style={{ gridColumn: 1, gridRow: row }} className="sticky left-0 z-[8] flex min-w-0 flex-col justify-center gap-1 border-b border-line-subtle bg-card px-4 py-2">
                <TaskOpenLink
                  taskId={t.id}
                  href={t.openHref}
                  className="flex min-w-0 items-center gap-2 rounded text-sm font-semibold text-fg outline-none hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <TypeBadge type={t.type} label={t.typeLabel} />
                  <span className={`truncate ${isDone(t) ? "opacity-60" : ""}`}>{t.title}</span>
                </TaskOpenLink>
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
                  {t.assignee && <Avatar name={t.assignee.name} url={t.assignee.avatarUrl} size={18} />}
                  <span className="truncate">{[t.assignee?.name ?? "ไม่มีผู้รับผิดชอบ", t.projectName].filter(Boolean).join(" · ")}</span>
                </p>
              </div>,
              ...days.map((d, i) => (
                <div key={`${t.id}:${d}`} aria-hidden="true" style={{ gridColumn: i + 2, gridRow: row }} className={`border-b border-l border-line-subtle ${i === todayCol ? tint : ""}`} />
              )),
              bar && (
                <BarPiece key={`${t.id}:b`} task={t} clip={bar} style={place(bar)}>
                  {weekBarLabel(t, start)}
                </BarPiece>
              ),
              od && <OverduePiece key={`${t.id}:o`} task={t} clip={od} style={place(od)} />,
              ...t.points.map((p, i) => (
                <PointPill key={`${t.id}:p${i}`} task={t} point={p} style={{ gridColumn: colOf(p.day, start) + 2, gridRow: row }} />
              )),
            ];
          })}
        </div>
      </div>
    </div>
  );
}
