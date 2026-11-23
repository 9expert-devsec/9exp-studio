// Project Timeline maths — pure (no DB, no React, no DOM). Shared by the server
// loader, the client chart and the node checks. Components only render what
// these functions return.
//
// Days are counted in Asia/Bangkok (UTC+7, no DST): a "day index" is the number of
// Bangkok calendar days since 1970-01-01. A day index i starts at
// (i * DAY - 7h) UTC. A task bar runs from its Start day to its Due day inclusive.
//
// Task shape used here (lib/projects/queries.js loadTimeline):
//   { id, type, group, startAt: ISO | null, dueAt: ISO | null, assignee: { id } | null, … }

const DAY = 86_400_000;
const BKK_OFFSET = 7 * 3_600_000;

/** Bangkok day index of a Date / ISO string / ms timestamp; null when missing or invalid. */
export function dayIndex(value) {
  if (value == null || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? Math.floor((ms + BKK_OFFSET) / DAY) : null;
}

/** A Date whose UTC fields are the Bangkok calendar date of day index `i` (format with timeZone UTC). */
export const dayDate = (i) => new Date(i * DAY);

/** 0 = Sunday … 6 = Saturday (1970-01-01 was a Thursday). */
export const weekday = (i) => (((i + 4) % 7) + 7) % 7;
export const isWeekend = (i) => weekday(i) === 0 || weekday(i) === 6;

/** The Monday on or before day `i`. */
export const mondayOnOrBefore = (i) => i - ((weekday(i) + 6) % 7);

// ---------------------------------------------------------------------------
// Scales

/** Column width (px per day) and the ‹ › step (days) per scale. */
export const SCALES = {
  days: { label: "Days", dayWidth: 72, step: 7 },
  weeks: { label: "Weeks", dayWidth: 42, step: 28 },
  months: { label: "Months", dayWidth: 14, step: 91 },
};
export const SCALE_KEYS = ["days", "weeks", "months"]; // zoomed in → zoomed out
export const DEFAULT_SCALE = "weeks";
export const validScale = (s) => (SCALE_KEYS.includes(s) ? s : DEFAULT_SCALE);

/** − (zoom out, dir = +1) / + (zoom in, dir = -1): the neighbouring scale, or null at the end. */
export function stepScale(scale, dir) {
  const i = SCALE_KEYS.indexOf(validScale(scale)) + dir;
  return i >= 0 && i < SCALE_KEYS.length ? SCALE_KEYS[i] : null;
}

// ---------------------------------------------------------------------------
// Bars and rules

/**
 * The bar of one task, or null (no dates → Unscheduled).
 *   both dates → Start … Due   (kind "range"; reversed dates are swapped)
 *   only Due   → one day on Due   (kind "due")
 *   only Start → one day on Start (kind "start": faded right edge)
 * Posts are milestones: { start = end = Due day, kind "milestone" } or null without Due.
 */
export function taskSpan(task) {
  const s = dayIndex(task.startAt);
  const d = dayIndex(task.dueAt);
  if (task.type === "post") return d == null ? null : { start: d, end: d, kind: "milestone" };
  if (s != null && d != null) return { start: Math.min(s, d), end: Math.max(s, d), kind: "range" };
  if (d != null) return { start: d, end: d, kind: "due" };
  if (s != null) return { start: s, end: s, kind: "start" };
  return null;
}

export const isScheduled = (task) => taskSpan(task) !== null;

/** Overdue: Due is before now and the status group is not completed / cancelled (paused counts). */
export function isOverdue(task, nowMs) {
  if (!task.dueAt || task.group === "completed" || task.group === "cancelled") return false;
  const due = Date.parse(task.dueAt);
  return Number.isFinite(due) && due < nowMs;
}

/** "x/y done" — completed vs non-cancelled (same as the content card's progress). */
export function doneCount(tasks) {
  const live = tasks.filter((t) => t.group !== "cancelled");
  return { done: live.filter((t) => t.group === "completed").length, total: live.length };
}

/** Content summary bar: earliest Start … latest Due of its dated, non-cancelled tasks; null if none. */
export function groupSpan(tasks) {
  let start = null;
  let end = null;
  for (const t of tasks) {
    if (t.group === "cancelled") continue;
    const span = taskSpan(t);
    if (!span) continue;
    start = start == null ? span.start : Math.min(start, span.start);
    end = end == null ? span.end : Math.max(end, span.end);
  }
  return start == null ? null : { start, end };
}

/**
 * The chart window [start, end] (day indexes, inclusive): from the Monday on or
 * before the earliest dated task (or today, whichever is earlier) to two weeks
 * after the latest bar end (or today + 2 weeks, whichever is later), extended to
 * that week's Sunday so the grid ends on a full week.
 */
export function timelineWindow(tasks, nowMs) {
  const today = dayIndex(nowMs);
  let first = today;
  let last = today;
  for (const t of tasks) {
    const span = taskSpan(t);
    if (!span) continue;
    first = Math.min(first, span.start);
    last = Math.max(last, span.end);
  }
  const start = mondayOnOrBefore(first);
  const end = mondayOnOrBefore(last + 14) + 6;
  return { start, end, days: end - start + 1, today };
}

// ---------------------------------------------------------------------------
// Filters

export const STATUS_GROUP_FILTERS = [
  { key: "open", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];

export const emptyFilters = () => ({ types: [], assignees: [], groups: [], showCancelled: false, overdueOnly: false });

/** Number of active filter categories (the badge on the Filter button). */
export const activeFilterCount = (f) =>
  [f.types.length, f.assignees.length, f.groups.length, f.showCancelled, f.overdueOnly].filter(Boolean).length;

/** Does one task pass the filters? Cancelled tasks only with showCancelled. */
export function matchesFilters(task, f, nowMs) {
  if (task.group === "cancelled" && !f.showCancelled) return false;
  if (f.types.length && !f.types.includes(task.type)) return false;
  if (f.assignees.length && !f.assignees.includes(task.assignee?.id ?? "")) return false;
  if (f.groups.length && task.group !== "cancelled" && !f.groups.includes(task.group)) return false;
  if (f.overdueOnly && !isOverdue(task, nowMs)) return false;
  return true;
}

/**
 * Apply the filters to the content groups.
 *   rows        per content: { ...content, tasks: matching SCHEDULED tasks, all: every task }
 *               — a group with no matching tasks disappears while any filter is active
 *   unscheduled matching tasks with no dates, never cancelled (content order, then task order)
 * @param {{ id: string, tasks: object[] }[]} contents in display order, tasks in display order
 */
export function applyFilters(contents, f, nowMs) {
  // Only NARROWING filters hide empty groups ("Show cancelled" widens the view).
  const filtering = f.types.length > 0 || f.assignees.length > 0 || f.groups.length > 0 || f.overdueOnly;
  const rows = [];
  const unscheduled = [];
  for (const c of contents) {
    const matching = c.tasks.filter((t) => matchesFilters(t, f, nowMs));
    const scheduled = matching.filter(isScheduled);
    for (const t of matching) if (!isScheduled(t) && t.group !== "cancelled") unscheduled.push({ ...t, contentName: c.name });
    if (filtering && scheduled.length === 0) continue;
    rows.push({ ...c, all: c.tasks, tasks: scheduled });
  }
  return { rows, unscheduled };
}

// ---------------------------------------------------------------------------
// Labels (Thai months, Gregorian year — "23 พ.ย. – 13 ธ.ค. 2026")

const TH_MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH_LONG = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parts = (i) => {
  const d = dayDate(i);
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
};

export const dayNumber = (i) => parts(i).day;
export const weekdayShort = (i) => WEEKDAY_SHORT[weekday(i)];

/** "24 พ.ย." (+ " 2026" with year). */
export function dayLabel(i, withYear = false) {
  const p = parts(i);
  return `${p.day} ${TH_MONTH_SHORT[p.month]}${withYear ? ` ${p.year}` : ""}`;
}

/** "23 พ.ย. – 13 ธ.ค. 2026"; across years both carry the year; one day → "24 พ.ย. 2026". */
export function rangeLabel(a, b, withYear = true) {
  if (a === b) return dayLabel(a, withYear);
  const sameYear = parts(a).year === parts(b).year;
  return `${dayLabel(a, withYear && !sameYear)} – ${dayLabel(b, withYear)}`;
}

/** Bar text: "24 พ.ย. – 2 ธ.ค. · รอตรวจ" (one day: "24 พ.ย. · รอตรวจ"). */
export const barLabel = (span, statusLabel) =>
  `${rangeLabel(span.start, span.end, false)}${statusLabel ? ` · ${statusLabel}` : ""}`;

/** "HH:mm" in Bangkok for a datetime. */
export function bangkokTime(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms + BKK_OFFSET);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Month header segments inside the window: [{ key, label, from, days }] (from = offset in days). */
export function monthSegments(win) {
  const out = [];
  for (let i = win.start; i <= win.end; ) {
    const p = parts(i);
    const next = Math.floor(Date.UTC(p.year, p.month + 1, 1) / DAY);
    const to = Math.min(next - 1, win.end);
    out.push({ key: `${p.year}-${p.month}`, label: `${TH_MONTH_LONG[p.month]} ${p.year}`, from: i - win.start, days: to - i + 1 });
    i = to + 1;
  }
  return out;
}

/** Visible day range for a scroll position: [first, last] day indexes, clamped to the window. */
export function visibleDays(win, scrollLeft, viewportWidth, dayWidth) {
  const first = Math.max(0, Math.floor(scrollLeft / dayWidth));
  const last = Math.max(first, Math.ceil((scrollLeft + Math.max(0, viewportWidth)) / dayWidth) - 1);
  return { first: win.start + first, last: Math.min(win.end, win.start + last) };
}
