// All Tasks calendar (round 57) — pure date / layout rules (no DB, no React).
// Shared by the server loader (lib/tasks/allTasks.js: the range it queries), the
// client calendar (components/tasks/AllTasksCalendar.jsx: lanes, clipping) and
// node checks. Every day is a Bangkok calendar day "YYYY-MM-DD"; weeks run
// Monday → Sunday. Spans are INCLUSIVE day ranges { start, end }.
//
// A task's bar:   Start + Due → Start..Due · Due only → Due · Start only → Start ·
//                 neither → no bar.
// Overdue:        Due before today and the stage is not done / stopped → a dashed
//                 segment Due+1 .. today, "เลย N วัน" (N = today − Due).
// Lanes (month):  per WEEK ROW, greedy by start (longer first); a task's bar and its
//                 overdue segment share one lane, so a bar keeps its lane across the
//                 row. Lanes ≥ MONTH_LANES are hidden and counted as "+N งาน".

import { addDays, daysBetween, weekStart } from "./allTasksFilters.js";

export const MONTH_LANES = 3;
export const THAI_DAY_ABBR = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."]; // Monday first

const monthLong = new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("th-TH", { month: "short", timeZone: "UTC" });
const asDate = (key) => new Date(`${key}T12:00:00Z`);
const dayNum = (key) => Number(key.slice(8, 10));
const ce = (key) => key.slice(0, 4);

/** "2026-11-27" → "27 พ.ย." */
export const shortDay = (key) => `${dayNum(key)} ${monthShort.format(asDate(key))}`;

/** The month grid of `anchor`: Monday before the 1st … Sunday after the last day. */
export function monthRange(anchor) {
  const first = `${anchor.slice(0, 7)}-01`;
  const next = asDate(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = addDays(next.toISOString().slice(0, 10), -1);
  const start = weekStart(first);
  const end = addDays(weekStart(last), 6);
  const weeks = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return { start, end, month: anchor.slice(0, 7), weeks };
}

/** The Mon–Sun week of `anchor`. */
export function weekRange(anchor) {
  const start = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { start, end: days[6], days };
}

/** "พฤศจิกายน 2026" */
export const monthTitle = (anchor) => `${monthLong.format(asDate(anchor))} ${ce(anchor)}`;

/** "23 – 29 พ.ย. 2026" · "30 พ.ย. – 6 ธ.ค. 2026" · "29 ธ.ค. 2026 – 4 ม.ค. 2027" */
export function weekTitle(anchor) {
  const { start, end } = weekRange(anchor);
  if (ce(start) !== ce(end)) return `${shortDay(start)} ${ce(start)} – ${shortDay(end)} ${ce(end)}`;
  if (start.slice(5, 7) !== end.slice(5, 7)) return `${shortDay(start)} – ${shortDay(end)} ${ce(end)}`;
  return `${dayNum(start)} – ${shortDay(end)} ${ce(end)}`;
}

/** The anchor one period before / after (month keeps day 1; week moves 7 days). */
export function shiftAnchor(anchor, cal, dir) {
  if (cal === "week") return addDays(anchor, 7 * dir);
  const d = asDate(`${anchor.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() + dir);
  return d.toISOString().slice(0, 10);
}

/** The inclusive day range shown for a view. */
export const visibleRange = (cal, anchor) => (cal === "week" ? weekRange(anchor) : monthRange(anchor));

/**
 * The bar of a task, or null. Keys are Bangkok days.
 * @param {{ startKey: string|null, dueKey: string|null }} t
 */
export function barSpan({ startKey, dueKey }) {
  if (startKey && dueKey) return startKey <= dueKey ? { start: startKey, end: dueKey } : { start: dueKey, end: startKey };
  const one = dueKey || startKey;
  return one ? { start: one, end: one } : null;
}

/**
 * The overdue segment (Due+1 .. today) or null.
 * @param {{ dueKey: string|null, stage: string }} t  stage "done" / "stopped" never overdue
 */
export function overdueSpan({ dueKey, stage }, todayKey) {
  if (!dueKey || dueKey >= todayKey || stage === "done" || stage === "stopped") return null;
  return { start: addDays(dueKey, 1), end: todayKey, days: daysBetween(dueKey, todayKey) };
}

/** A span clipped to [from, to]: { start, end, cutStart, cutEnd } or null (outside). */
export function clipSpan(span, from, to) {
  if (!span || span.end < from || span.start > to) return null;
  return {
    ...span,
    start: span.start < from ? from : span.start,
    end: span.end > to ? to : span.end,
    cutStart: span.start < from,
    cutEnd: span.end > to,
  };
}

/** Column index (0–6) of a day inside a week starting `weekStartKey`. */
export const colOf = (key, weekStartKey) => daysBetween(weekStartKey, key);

/**
 * Lanes for one week row. `items`: { id, start, end } (inclusive days, already
 * the union of a task's pieces). Returns the same items + `lane`, and, per day,
 * how many items fall in hidden lanes (≥ maxLanes).
 * @returns {{ placed: object[], hidden: number[] }} hidden[i] for day i (Mon = 0)
 */
export function layoutLanes(items, weekDays, maxLanes = MONTH_LANES) {
  const from = weekDays[0];
  const to = weekDays[6];
  const inRow = items
    .map((it) => ({ ...it, s: it.start < from ? from : it.start, e: it.end > to ? to : it.end }))
    .filter((it) => it.s <= it.e)
    .sort((a, b) => (a.s === b.s ? daysBetween(b.s, b.e) - daysBetween(a.s, a.e) || String(a.id).localeCompare(String(b.id)) : a.s < b.s ? -1 : 1));
  const laneEnd = []; // last occupied day per lane
  const placed = inRow.map(({ s, e, ...it }) => {
    let lane = laneEnd.findIndex((end) => end < s);
    if (lane < 0) lane = laneEnd.length;
    laneEnd[lane] = e;
    return { ...it, lane, s, e };
  });
  const hidden = weekDays.map((d) => placed.filter((p) => p.lane >= maxLanes && p.s <= d && p.e >= d).length);
  return { placed, hidden };
}

/**
 * Week view order: overdue first (most overdue first), then Due ascending; no Due
 * last; ties by title.
 * @param {{ dueKey: string|null, stage: string, title: string }[]} tasks
 */
export function weekOrder(tasks, todayKey) {
  const late = (t) => overdueSpan(t, todayKey)?.days ?? 0;
  return [...tasks].sort((a, b) => {
    const la = late(a);
    const lb = late(b);
    if (la || lb) return lb - la || cmpDue(a, b);
    return cmpDue(a, b);
  });
}
function cmpDue(a, b) {
  if (a.dueKey && b.dueKey && a.dueKey !== b.dueKey) return a.dueKey < b.dueKey ? -1 : 1;
  if (!a.dueKey !== !b.dueKey) return a.dueKey ? -1 : 1;
  return String(a.title).localeCompare(String(b.title), "th");
}

/** Week bar label: "เริ่ม 20 พ.ย. · Due 25 พ.ย." · "Due 26 พ.ย." (starts before the week / due only) · "เริ่ม 20 พ.ย." (start only). */
export function weekBarLabel({ startKey, dueKey }, weekStartKey) {
  if (dueKey && startKey && startKey !== dueKey && startKey >= weekStartKey) return `เริ่ม ${shortDay(startKey)} · Due ${shortDay(dueKey)}`;
  if (dueKey) return `Due ${shortDay(dueKey)}`;
  return startKey ? `เริ่ม ${shortDay(startKey)}` : "";
}
