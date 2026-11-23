"use client";

// The Gantt grid (rendering only; the maths lives in lib/timeline/layout.js).
// Layout: one horizontal scroller (the body) whose rows are [sticky left column |
// day grid]. The header is a SEPARATE strip, sticky under the app header while the
// page scrolls; its own (hidden) horizontal scroll is kept equal to the body's by
// the parent. Left column width = --tl-left (narrow on mobile: icon + title only,
// no assignee column). A background layer under the rows draws the weekend
// shading, month dividers and today's dashed line.

import Link from "next/link";
import { ChevronDown, CircleCheck, Folder, ListChecks } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import PlatformIcon from "@/components/tasks/PlatformIcon";
import TaskOpenLink from "@/components/tasks/TaskOpenLink";
import {
  barLabel,
  bangkokTime,
  dayLabel,
  dayNumber,
  doneCount,
  groupSpan,
  isOverdue,
  isWeekend,
  rangeLabel,
  taskSpan,
  weekday,
  weekdayShort,
} from "@/lib/timeline/layout";
import { getTaskType, taskTypeTone } from "@/lib/tasks/types";

export const LEFT_VARS = "[--tl-left:176px] sm:[--tl-left:380px]";
const GROUP_H = 52;
const TASK_H = 40;
const leftCell =
  "sticky left-0 z-20 flex w-[var(--tl-left)] shrink-0 items-center border-r border-line bg-card";
const assigneeCol = "hidden w-20 shrink-0 items-center justify-center sm:flex";

/** Type icon, or the green check for a completed task. */
export function TaskGlyph({ task }) {
  if (task.group === "completed") {
    return <CircleCheck className="size-4 shrink-0 text-success" aria-label="Completed" />;
  }
  const Icon = getTaskType(task.type)?.icon ?? ListChecks;
  return <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />;
}

/** The card's assignee display: avatar (+N other Production people), or nothing. */
export function AssigneeBadge({ task, withName = false }) {
  if (!task.assignee) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={task.assignee.name}>
      <Avatar name={task.assignee.name} url={task.assignee.avatarUrl} size={24} />
      {withName && <span className="truncate text-xs font-medium text-fg">{task.assignee.name}</span>}
      {task.extraPeople > 0 && (
        <span className="shrink-0 rounded-full bg-track px-1.5 py-px text-[10px] font-semibold text-fg-muted">
          +{task.extraPeople}
          <span className="sr-only"> more {task.extraPeople === 1 ? "person" : "people"}</span>
        </span>
      )}
      {!withName && <span className="sr-only">{task.assignee.name}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Header

export function TimelineHeader({ win, dayWidth, months, scale, headerRef }) {
  const width = win.days * dayWidth;
  const days = Array.from({ length: win.days }, (_, k) => win.start + k);
  return (
    <div ref={headerRef} className="overflow-hidden rounded-t-[16px]">
      <div className={`flex ${LEFT_VARS}`} style={{ width: `calc(var(--tl-left) + ${width}px)` }}>
        <div className={`${leftCell} items-end self-stretch pb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted`}>
          <span className="min-w-0 flex-1 truncate px-3 sm:px-4">Content / Task</span>
          <span className={`${assigneeCol} normal-case tracking-normal`}>Assignee</span>
        </div>
        <div className="shrink-0" style={{ width }}>
          <div className="relative h-8 border-b border-line-subtle">
            {months.map((m, i) => (
              <div
                key={m.key}
                className={`absolute inset-y-0 flex items-center justify-center overflow-hidden px-1 text-xs font-semibold text-fg ${
                  i > 0 ? "border-l border-line" : ""
                }`}
                style={{ left: m.from * dayWidth, width: m.days * dayWidth }}
              >
                <span className="truncate">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="relative flex h-12">
            {days.map((d) => {
              const isToday = d === win.today;
              const showNumber = scale !== "months" || weekday(d) === 1 || isToday;
              return (
                <div
                  key={d}
                  className={`relative flex shrink-0 flex-col items-center justify-center leading-tight ${
                    isWeekend(d) ? "bg-track/40" : ""
                  } ${dayNumber(d) === 1 && d !== win.start ? "border-l border-line" : ""}`}
                  style={{ width: dayWidth }}
                >
                  {showNumber && (
                    <span
                      className={`whitespace-nowrap text-xs tabular-nums ${
                        isToday
                          ? "rounded-md bg-brand-500 px-1.5 font-bold text-navy"
                          : "font-semibold text-fg"
                      }`}
                    >
                      {dayNumber(d)}
                    </span>
                  )}
                  {isToday ? (
                    <span className="mt-0.5 whitespace-nowrap rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-fg">
                      Today
                    </span>
                  ) : (
                    scale !== "months" && <span className="text-[10px] text-fg-muted">{weekdayShort(d)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body

/** Weekend shading + day lines (CSS gradients: the window starts on a Monday), month dividers, today. */
function GridBackground({ win, dayWidth, months, scale }) {
  const week = 7 * dayWidth;
  const weekend = "color-mix(in srgb, var(--ds-track) 45%, transparent)";
  const layers = [
    `linear-gradient(to right, transparent ${5 * dayWidth}px, ${weekend} ${5 * dayWidth}px, ${weekend} ${week}px)`,
  ];
  const sizes = [`${week}px 100%`];
  if (scale !== "months") {
    layers.unshift("linear-gradient(to right, var(--ds-line-subtle) 1px, transparent 1px)");
    sizes.unshift(`${dayWidth}px 100%`);
  }
  const todayLeft = (win.today - win.start) * dayWidth + dayWidth / 2;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-[var(--tl-left)] z-0"
      style={{ width: win.days * dayWidth, backgroundImage: layers.join(","), backgroundSize: sizes.join(",") }}
    >
      {months.slice(1).map((m) => (
        <span key={m.key} className="absolute inset-y-0 border-l border-line" style={{ left: m.from * dayWidth }} />
      ))}
      {win.today >= win.start && win.today <= win.end && (
        <span className="absolute inset-y-0 border-l-2 border-dashed border-brand-500" style={{ left: todayLeft - 1 }} />
      )}
    </div>
  );
}

const pos = (span, win, dayWidth) => ({
  left: (span.start - win.start) * dayWidth + 2,
  width: Math.max(dayWidth - 4, (span.end - span.start + 1) * dayWidth - 4),
});

const OverdueBadge = () => (
  <span className="shrink-0 rounded bg-danger-solid px-1 py-px text-[10px] font-semibold leading-tight text-white">Overdue</span>
);

const stripes = {
  backgroundImage:
    "repeating-linear-gradient(135deg, color-mix(in srgb, var(--ds-fg-muted) 22%, transparent) 0 4px, transparent 4px 9px)",
};

function TaskBar({ task, span, win, dayWidth, nowMs }) {
  const { left, width } = pos(span, win, dayWidth);
  const overdue = isOverdue(task, nowMs);
  const cancelled = task.group === "cancelled";
  const label = barLabel(span, task.statusLabel);
  const full = `${task.typeLabel} · ${task.title} — ${label}${overdue ? " · Overdue" : ""}${
    span.kind === "start" ? " (no due date)" : ""
  }`;
  const badgeInside = overdue && width >= 120;
  const startOnly = span.kind === "start";
  return (
    <>
      <TaskOpenLink
        taskId={task.id}
        href={task.openHref}
        title={full}
        aria-label={full}
        className={`absolute top-1/2 z-10 flex h-6 -translate-y-1/2 items-center gap-1 overflow-hidden whitespace-nowrap rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
          cancelled ? "border border-line bg-card text-fg-muted line-through" : taskTypeTone(task.type)
        } ${overdue ? "ring-2 ring-danger ring-inset" : ""} ${startOnly ? "border-r-2 border-dashed border-r-fg-muted" : ""}`}
        style={{
          left,
          width,
          ...(cancelled ? stripes : null),
          ...(startOnly ? { maskImage: "linear-gradient(to right, #000 55%, rgba(0,0,0,0.4))" } : null),
        }}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badgeInside && <OverdueBadge />}
      </TaskOpenLink>
      {overdue && !badgeInside && (
        <span aria-hidden="true" className="absolute top-1/2 z-10 -translate-y-1/2" style={{ left: left + width + 4 }}>
          <OverdueBadge />
        </span>
      )}
    </>
  );
}

function PostMilestone({ task, span, win, dayWidth, nowMs }) {
  const center = (span.start - win.start) * dayWidth + dayWidth / 2;
  const overdue = isOverdue(task, nowMs);
  const cancelled = task.group === "cancelled";
  const [first, ...more] = task.platforms;
  const time = bangkokTime(task.dueAt);
  const date = dayLabel(span.start, true);
  const name = first?.label ?? "Post";
  const full = `${task.typeLabel} · ${task.title} — ${name}${more.length ? ` +${more.length}` : ""} · ${time}, ${date} · ${
    task.statusLabel
  }${overdue ? " · Overdue" : ""}`;
  return (
    <>
      <span
        aria-hidden="true"
        className={`absolute top-1/2 z-10 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ${
          cancelled ? "bg-fg-muted" : "bg-brand-500"
        } ${overdue ? "ring-2 ring-danger" : ""}`}
        style={{ left: center }}
      />
      <TaskOpenLink
        taskId={task.id}
        href={task.openHref}
        title={full}
        aria-label={full}
        className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg border bg-card px-2 py-0.5 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
          overdue ? "border-danger" : "border-brand-300 dark:border-brand-700"
        } ${cancelled ? "line-through opacity-60" : ""}`}
        style={{ left: center + 12 }}
      >
        {first && <PlatformIcon icon={first.icon} size={16} />}
        <span className="leading-tight">
          <span className="block text-[11px] font-semibold text-fg">
            {name}
            {more.length > 0 && <span className="font-medium text-fg-muted"> +{more.length}</span>} · {time}
          </span>
          <span className="block text-[10px] text-fg-muted">{date}</span>
        </span>
        {overdue && <OverdueBadge />}
      </TaskOpenLink>
    </>
  );
}

function GroupRow({ row, collapsed, onToggle, win, dayWidth, width }) {
  const { done, total } = doneCount(row.all);
  const span = groupSpan(row.all);
  return (
    <div className="flex bg-track/25" style={{ height: GROUP_H }}>
      <div data-left className={`${leftCell} bg-card-inset`}>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-1.5 pr-2 sm:pl-2.5">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${row.name}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-track hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ChevronDown className={`size-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} aria-hidden="true" />
          </button>
          <Folder className="hidden size-4 shrink-0 text-fg-muted sm:block" aria-hidden="true" />
          <div className="min-w-0">
            <Link
              href={row.href}
              className="block truncate text-sm font-semibold text-fg hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-brand-500"
              title={row.name}
            >
              {row.name}
            </Link>
            <p className="text-[11px] text-fg-muted">
              {done}/{total} done
            </p>
          </div>
        </div>
        <span className={`${assigneeCol} text-fg-muted`} aria-hidden="true">
          –
        </span>
      </div>
      <div className="relative shrink-0" style={{ width }}>
        {span && (
          <span
            className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden whitespace-nowrap rounded-md bg-fg-muted/35 px-2 text-[11px] font-medium text-fg"
            style={pos(span, win, dayWidth)}
            title={`${row.name}: ${rangeLabel(span.start, span.end)}`}
          >
            <span className="truncate">{rangeLabel(span.start, span.end, false)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, win, dayWidth, width, nowMs }) {
  const span = taskSpan(task);
  const cancelled = task.group === "cancelled";
  return (
    <div className="flex" style={{ height: TASK_H }}>
      <div data-left className={leftCell}>
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-3 pr-2 sm:pl-10">
          <TaskGlyph task={task} />
          <TaskOpenLink
            taskId={task.id}
            href={task.openHref}
            title={`${task.typeLabel} · ${task.title}`}
            className={`min-w-0 truncate rounded text-sm hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-brand-500 ${
              cancelled ? "text-fg-muted line-through" : "text-fg"
            }`}
          >
            <span className="hidden font-semibold sm:inline">{task.typeLabel}</span>
            <span className="hidden sm:inline"> · </span>
            {task.title}
          </TaskOpenLink>
        </div>
        <span className={assigneeCol}>
          {task.assignee ? <AssigneeBadge task={task} /> : <span className="text-fg-muted">–</span>}
        </span>
      </div>
      <div className="relative shrink-0" style={{ width }}>
        {span &&
          (span.kind === "milestone" ? (
            <PostMilestone task={task} span={span} win={win} dayWidth={dayWidth} nowMs={nowMs} />
          ) : (
            <TaskBar task={task} span={span} win={win} dayWidth={dayWidth} nowMs={nowMs} />
          ))}
      </div>
    </div>
  );
}

export function TimelineBody({ rows, collapsed, onToggle, win, dayWidth, months, scale, nowMs, bodyRef, onScroll }) {
  const width = win.days * dayWidth;
  return (
    <div ref={bodyRef} onScroll={onScroll} className="overflow-x-auto rounded-b-[16px]">
      <div className={`relative ${LEFT_VARS}`} style={{ width: `calc(var(--tl-left) + ${width}px)` }}>
        <GridBackground win={win} dayWidth={dayWidth} months={months} scale={scale} />
        <div className="relative divide-y divide-line-subtle">
          {rows.map((row) => {
            const isCollapsed = collapsed.has(row.id);
            return (
              <div key={row.id} role="group" aria-label={row.name} className="divide-y divide-line-subtle">
                <GroupRow
                  row={row}
                  collapsed={isCollapsed}
                  onToggle={() => onToggle(row.id)}
                  win={win}
                  dayWidth={dayWidth}
                  width={width}
                />
                {!isCollapsed &&
                  row.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} win={win} dayWidth={dayWidth} width={width} nowMs={nowMs} />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
