"use client";

// The Gantt grid (rendering only; the maths lives in lib/timeline/layout.js).
// Round 43: everything sits in ONE bounded card (ProjectTimeline), top to bottom:
//   header  [left header cell | day-grid header viewport (overflow hidden)]
//   body    the vertical scroller: [left column | day-grid viewport — overflow-x
//           auto with the native bar hidden = THE scrollLeft source]
//   strip   [empty under the left column | ‹ track + thumb ›] (TimelineScrollbar)
// Left and right columns render the same flattened row list with the same fixed
// heights (bottom border included), so they line up. Left width = --tl-left (narrow
// on mobile: icon + title, no assignee column). Header, body and strip all reserve
// the vertical-scrollbar gutter, so their right parts are exactly as wide.

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Folder, ListChecks } from "lucide-react";
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
// One row = fixed height incl. its bottom border, identical in both columns.
const rowBase = "flex items-center border-b border-line-subtle";
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
    <div className="flex shrink-0 border-b border-line bg-card">
      <div className="flex w-[var(--tl-left)] shrink-0 items-end border-r border-line bg-card pb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
        <span className="min-w-0 flex-1 truncate px-3 sm:px-4">Content / Task</span>
        <span className={`${assigneeCol} normal-case tracking-normal`}>Assignee</span>
      </div>
      {/* Hidden horizontal scroll, kept equal to the body's by ProjectTimeline. */}
      <div ref={headerRef} className="min-w-0 flex-1 overflow-hidden bg-card [scrollbar-gutter:stable]">
        <div className="bg-card" style={{ width }}>
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
      className="pointer-events-none absolute inset-y-0 left-0 z-0"
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

function GroupLeft({ row, collapsed, onToggle }) {
  const { done, total } = doneCount(row.all);
  return (
    <div className={`${rowBase} bg-card-inset`} style={{ height: GROUP_H }}>
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
  );
}

function GroupRight({ row, win, dayWidth }) {
  const span = groupSpan(row.all);
  return (
    <div className={`${rowBase} relative bg-track/25`} style={{ height: GROUP_H }}>
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
  );
}

function TaskLeft({ task }) {
  const cancelled = task.group === "cancelled";
  return (
    <div className={rowBase} style={{ height: TASK_H }}>
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
  );
}

function TaskRight({ task, win, dayWidth, nowMs }) {
  const span = taskSpan(task);
  return (
    <div className={`${rowBase} relative`} style={{ height: TASK_H }}>
      {span &&
        (span.kind === "milestone" ? (
          <PostMilestone task={task} span={span} win={win} dayWidth={dayWidth} nowMs={nowMs} />
        ) : (
          <TaskBar task={task} span={span} win={win} dayWidth={dayWidth} nowMs={nowMs} />
        ))}
    </div>
  );
}

/** Group + (unless collapsed) task rows, flattened in display order. */
const flatRows = (rows, collapsed) =>
  rows.flatMap((row) => [
    { key: `g-${row.id}`, row },
    ...(collapsed.has(row.id) ? [] : row.tasks.map((task) => ({ key: `t-${task.id}`, task }))),
  ]);

/**
 * The body: ONE vertical scroller holding [left column | day-grid viewport]. The
 * day-grid viewport (bodyRef) is the only horizontal scroller and THE scrollLeft
 * source; its native bar is hidden (the card's bottom strip replaces it), while
 * trackpad / shift+wheel still scroll it. The left column never moves sideways.
 */
export function TimelineBody({ rows, collapsed, onToggle, win, dayWidth, months, scale, nowMs, bodyRef, onScroll, bodyId }) {
  const width = win.days * dayWidth;
  const items = flatRows(rows, collapsed);
  return (
    <div className="flex min-h-0 flex-1 items-start overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
      <div className="w-[var(--tl-left)] shrink-0 border-r border-line bg-card">
        {items.map((it) =>
          it.row ? (
            <GroupLeft key={it.key} row={it.row} collapsed={collapsed.has(it.row.id)} onToggle={() => onToggle(it.row.id)} />
          ) : (
            <TaskLeft key={it.key} task={it.task} />
          )
        )}
      </div>
      <div
        id={bodyId}
        ref={bodyRef}
        onScroll={onScroll}
        className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative" style={{ width }}>
          <GridBackground win={win} dayWidth={dayWidth} months={months} scale={scale} />
          <div className="relative">
            {items.map((it) =>
              it.row ? (
                <GroupRight key={it.key} row={it.row} win={win} dayWidth={dayWidth} />
              ) : (
                <TaskRight key={it.key} task={it.task} win={win} dayWidth={dayWidth} nowMs={nowMs} />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom scrollbar strip

/**
 * The card's horizontal scrollbar (Figma 233:463 track / 233:464 thumb), pinned to
 * the bottom of the card under the day grid only, with ‹ › at its ends. It holds
 * no scroll state: the parent positions the thumb (thumbRef) from the body's
 * scrollLeft; these handlers only ask the parent to scroll the body.
 */
export function TimelineScrollbar({ trackRef, thumbRef, bodyId, onThumbDown, onTrackDown, onStep }) {
  const arrow =
    "flex size-7 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-track hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500";
  return (
    <div className="flex shrink-0 border-t border-line bg-card">
      <div className="w-[var(--tl-left)] shrink-0 border-r border-line" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden px-1 py-1 [scrollbar-gutter:stable]">
        <button type="button" className={arrow} aria-label="Scroll timeline left" onClick={() => onStep(-1)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <div
          ref={trackRef}
          role="scrollbar"
          aria-controls={bodyId}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-label="Timeline horizontal scroll"
          onPointerDown={onTrackDown}
          className="relative h-2.5 min-w-0 flex-1 cursor-pointer rounded-full bg-track"
        >
          <div
            ref={thumbRef}
            onPointerDown={onThumbDown}
            className="absolute inset-y-0 left-0 w-full cursor-grab touch-none rounded-full bg-fg-muted/60 hover:bg-fg-muted active:cursor-grabbing"
          />
        </div>
        <button type="button" className={arrow} aria-label="Scroll timeline right" onClick={() => onStep(1)}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
