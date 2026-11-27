// Work Plan (round 47) — pure rules (no DB, no React). THE one module the Work
// Plan tab, its dialogs and the server actions (workplan-actions.js) all call.
//
// Two independent things per task + person + day (models/TaskWorkEntry.js):
//   plan  intended time          log  actual time worked
// A log belongs to the DATE, never to a plan. Dates are Bangkok calendar days
// "YYYY-MM-DD"; times "HH:mm"; no entry crosses midnight.
// Each entry is either a time RANGE (start–end, end after start) or HOURS only
// (minutes, a 0.25 h step, no position in the day — never overlaps anything).

import { formatThaiDay } from "../projects/format.js";

export const STEP_MIN = 15; // 0.25 h
export const DAY_MIN = 24 * 60;
export const NOTE_MAX = 1000;
export const MAX_CARDS = 31;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// ── Time + date helpers ───────────────────────────────────────────────────

/** "HH:mm" → minutes since 00:00, or null. */
export const toMin = (hhmm) => {
  const m = HHMM.exec(String(hhmm ?? ""));
  return m ? +m[1] * 60 + +m[2] : null;
};

export const TIME_FORMAT_ERROR = "รูปแบบเวลาไม่ถูกต้อง (เช่น 09:30)";

/**
 * Typed time → "HH:mm" (24 h), "" for empty, or null when invalid (round 47.1).
 * "9" → 09:00 · "930" → 09:30 · "0930" → 09:30 · "9:30" / "9.30" → 09:30.
 * Hours 00–23, minutes 00–59 ("24:00", "12:60" are invalid).
 */
export function parseTimeInput(text) {
  const t = String(text ?? "").trim();
  if (!t) return "";
  let h;
  let m;
  const sep = /^(\d{1,2})[:.](\d{1,2})$/.exec(t);
  if (sep) [h, m] = [+sep[1], +sep[2]];
  else if (/^\d{1,4}$/.test(t)) {
    if (t.length <= 2) [h, m] = [+t, 0];
    else [h, m] = [+t.slice(0, -2), +t.slice(-2)];
  } else return null;
  if (sep && sep[2].length !== 2) return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Days a plan date is after the task's Due date (0 when not, or no due). Date only — no times needed. */
export const pastDueDays = (date, dueDate) => (dueDate && isDateStr(date) && date > dueDate ? daysBetween(dueDate, date) : 0);

/** A real calendar day "YYYY-MM-DD"? */
export function isDateStr(s) {
  const m = DATE.exec(String(s ?? ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const dayMs = (s) => {
  const m = DATE.exec(s);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
};
/** "YYYY-MM-DD" + n days. */
export const addDays = (s, n) => new Date(dayMs(s) + n * 86400000).toISOString().slice(0, 10);
/** Whole days from a to b (b − a). */
export const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / 86400000);

const bkk = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
/** A Date (or ms) → its Bangkok calendar day "YYYY-MM-DD"; null for none. */
export const bangkokDay = (value) => (value == null || value === "" ? null : bkk.format(new Date(value)));

/** Minutes of one entry. */
export const entryMinutes = (e) => (e.mode === "range" ? toMin(e.end) - toMin(e.start) : (e.minutes ?? 0));

/** Two entries overlap: both ranges and they share time (touching edges don't). */
export function overlaps(a, b) {
  if (a?.mode !== "range" || b?.mode !== "range") return false;
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

// ── Formats ───────────────────────────────────────────────────────────────

/** 150 → "2 ชม. 30 นาที" ("2 ชม. 30 น." compact), 120 → "2 ชม.", 45 → "45 นาที". */
export function formatDuration(min, { compact = false } = {}) {
  const total = Math.max(0, Math.round(min ?? 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const mm = `${m} ${compact ? "น." : "นาที"}`;
  if (!h) return mm;
  return m ? `${h} ชม. ${mm}` : `${h} ชม.`;
}

/** The over-plan pill text: "+25 นาที", "+1 ชม. 5 นาที". */
export const formatOver = (min) => `+${formatDuration(min)}`;

/** "10:00–12:00" or "1.5 ชม." */
export const entryLabel = (e) => (e.mode === "range" ? `${e.start}–${e.end}` : `${+(entryMinutes(e) / 60).toFixed(2)} ชม.`);

// ── Input parsing (dialogs + server) ──────────────────────────────────────

/**
 * One posted plan / log entry → a clean value or an error (Thai).
 * raw: { date, mode: "range"|"hours", start, end, hours }
 * @param {{ kind: "plan"|"log", today: string }} ctx  logs can't be in the future
 * @returns {{ value: { date, mode, start, end, minutes } } | { error: string, field: string }}
 */
export function parseEntry(raw, { kind, today }) {
  const date = String(raw?.date ?? "");
  if (!isDateStr(date)) return { error: "เลือกวันที่", field: "date" };
  if (kind === "log" && today && date > today) return { error: "บันทึกเวลาของวันในอนาคตไม่ได้", field: "date" };
  if (raw?.mode === "hours") {
    const hours = Number(raw.hours);
    const minutes = Math.round(hours * 60);
    if (!Number.isFinite(hours) || hours <= 0) return { error: "ใส่จำนวนชั่วโมงมากกว่า 0", field: "hours" };
    if (minutes > DAY_MIN) return { error: "ไม่เกิน 24 ชม. ต่อวัน", field: "hours" };
    if (Math.abs(hours * 60 - minutes) > 1e-6 || minutes % STEP_MIN) return { error: "ใส่ทีละ 0.25 ชม. (15 นาที)", field: "hours" };
    return { value: { date, mode: "hours", start: null, end: null, minutes } };
  }
  const s = toMin(raw?.start);
  const e = toMin(raw?.end);
  if (s == null || e == null) return { error: "ใส่เวลาเริ่มและสิ้นสุด", field: "time" };
  if (e < s) return { error: "ข้ามเที่ยงคืนไม่ได้ — แยกเป็น 2 วัน", field: "time" };
  if (e === s) return { error: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม", field: "time" };
  return { value: { date, mode: "range", start: raw.start, end: raw.end, minutes: e - s } };
}

// ── Plan checks ───────────────────────────────────────────────────────────

/**
 * Checks for the plan cards of ONE save (Add plan / Edit plan), per card.
 * @param {{ id?: string, date, mode, start, end, minutes }[]} cards parsed values (id = editing that plan)
 * @param {{ taskId: string, existing: { id, taskId, taskTitle, date, mode, start, end, minutes }[], dueDate: string|null }} ctx
 *   existing = the PERSON's saved plans on every task (the cards' own ids are skipped)
 * @returns {{ error: string|null, warning: string|null, info: string|null, dueDays: number }[]}
 */
export function checkPlans(cards, { taskId, existing = [], dueDate = null }) {
  const editing = new Set(cards.map((c) => c.id).filter(Boolean));
  const saved = existing.filter((e) => !editing.has(String(e.id)));
  return cards.map((c, i) => {
    let error = null;
    const other = saved.find((e) => String(e.taskId) !== String(taskId) && e.date === c.date && overlaps(c, e));
    if (other) error = `ทับซ้อนกับแผนของ Task "${other.taskTitle}" ${other.start}–${other.end} — แก้ไขก่อนบันทึก`;
    const sameDay = saved.filter((e) => String(e.taskId) === String(taskId) && e.date === c.date);
    const same = sameDay.find((e) => overlaps(c, e)) ?? cards.find((x, j) => j !== i && x.date === c.date && overlaps(c, x));
    if (!error && same) error = `ทับกับแผนเดิมของ Task นี้ ${same.start}–${same.end}`;
    const dueDays = pastDueDays(c.date, dueDate);
    const warning = pastDueWarning(dueDays);
    const info = !error && sameDay.length ? `วันนี้มีแผนอยู่แล้ว ${sameDay.map(entryLabel).join(", ")} — ช่วงนี้จะรวมเข้าวันเดียวกัน` : null;
    return { error, warning, info, dueDays };
  });
}

/** The amber past-due note for N days (null for 0). */
export const pastDueWarning = (days) => (days ? `เลย Due Date ของ Task ${days} วัน — บันทึกได้` : null);

// ── Log checks ────────────────────────────────────────────────────────────

/**
 * Checks for the time rows of ONE log save (all on the same date), per row.
 * @param {{ id?: string, date, mode, start, end, minutes }[]} rows parsed values
 * @param {{ existing: { id, taskTitle, date, mode, start, end }[] }} ctx the PERSON's saved logs on
 *   every task (an edited row's own id is skipped) — one person can't work two places at once
 * @returns {(string|null)[]} an error per row
 */
export function checkLogs(rows, { existing = [] }) {
  const editing = new Set(rows.map((r) => r.id).filter(Boolean));
  const saved = existing.filter((e) => !editing.has(String(e.id)));
  return rows.map((r, i) => {
    const mine = rows.slice(0, i).find((x) => x.date === r.date && overlaps(r, x));
    if (mine) return `ช่วงเวลาทับกันเอง (${mine.start}–${mine.end})`;
    const hit = saved.find((e) => e.date === r.date && overlaps(r, e));
    return hit ? `ทับกับเวลาที่บันทึกไว้แล้ว (${hit.taskTitle} ${hit.start}–${hit.end})` : null;
  });
}

// ── Day summaries, rows, summary cards ────────────────────────────────────

/** One day's numbers. over = actual − planned, only when both exist and actual is more. */
export function daySummary(plans, logs) {
  const plannedMin = plans.reduce((t, e) => t + entryMinutes(e), 0);
  const actualMin = logs.reduce((t, e) => t + entryMinutes(e), 0);
  const overMin = plans.length && logs.length && actualMin > plannedMin ? actualMin - plannedMin : 0;
  return { plannedMin, actualMin, overMin };
}

/**
 * The ONE sub-label of a day row, by priority: วันนี้ · Due Date · เลยกำหนด (past,
 * plan, no log) · นอกแผน (log, no plan) · เลื่อนจาก <d MMM> · แผนไม่ระบุเวลา.
 * @returns {null | { key: string, text: string }}
 */
export function rowLabel({ date, today, dueDate, plans = [], logs = [] }) {
  if (date === today) return { key: "today", text: "วันนี้" };
  if (dueDate && date === dueDate) return { key: "due", text: "Due Date" };
  if (date < today && plans.length && !logs.length) return { key: "late", text: "เลยกำหนด" };
  if (logs.length && !plans.length) return { key: "offplan", text: "นอกแผน" };
  const moved = plans.find((p) => p.movedFrom);
  if (moved) return { key: "moved", text: `เลื่อนจาก ${formatThaiDay(moved.movedFrom, { weekday: false })}` };
  if (plans.length && plans.every((p) => p.mode === "hours")) return { key: "hours", text: "แผนไม่ระบุเวลา" };
  return null;
}

const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);
const sortEntries = (list) =>
  [...list].sort((a, b) => (a.mode === b.mode ? (a.start ?? "").localeCompare(b.start ?? "") : a.mode === "range" ? -1 : 1));

/**
 * Table rows for ONE person in [from, to]: days with a plan or a log, plus today
 * and the Due date when inside the range; oldest first.
 */
export function buildRows(plans, logs, { from, to, today, dueDate = null }) {
  const days = new Set([...plans, ...logs].map((e) => e.date).filter((d) => inRange(d, from, to)));
  for (const d of [today, dueDate]) if (d && inRange(d, from, to)) days.add(d);
  return [...days].sort().map((date) => {
    const p = sortEntries(plans.filter((e) => e.date === date));
    const l = sortEntries(logs.filter((e) => e.date === date));
    return { date, plans: p, logs: l, ...daySummary(p, l), label: rowLabel({ date, today, dueDate, plans: p, logs: l }) };
  });
}

/**
 * Summary cards for ONE person in [from, to].
 *   planned: total, days with a plan, plan entries ("ช่วงเวลา")
 *   actual: total; offPlanMin = logged on days with no plan; mustLogDays = past days
 *   (before today) with a plan and no log
 */
export function summaryCards(plans, logs, { from, to, today }) {
  const p = plans.filter((e) => inRange(e.date, from, to));
  const l = logs.filter((e) => inRange(e.date, from, to));
  const planDays = new Set(p.map((e) => e.date));
  const logDays = new Set(l.map((e) => e.date));
  return {
    plannedMin: p.reduce((t, e) => t + entryMinutes(e), 0),
    planDays: planDays.size,
    planEntries: p.length,
    actualMin: l.reduce((t, e) => t + entryMinutes(e), 0),
    offPlanMin: l.filter((e) => !planDays.has(e.date)).reduce((t, e) => t + entryMinutes(e), 0),
    mustLogDays: [...planDays].filter((d) => d < today && !logDays.has(d)).length,
  };
}

/** Default range: earliest of (task start, first plan, first log) → latest of (due, last plan, last log); today when nothing. */
export function defaultRange({ startDate = null, dueDate = null, entries = [], today }) {
  const days = entries.map((e) => e.date);
  const lows = [startDate, ...days].filter(Boolean).sort();
  const highs = [dueDate, ...days].filter(Boolean).sort();
  const from = lows[0] ?? today;
  const to = highs.at(-1) ?? today;
  return from <= to ? { from, to } : { from: to, to: from };
}

// ── Lane labels (round 47.1) ──────────────────────────────────────────────

export const MIN_BLOCK_PX = 10;
const LABEL_CHAR_PX = 6.2; // conservative for the 10px label font ("10:00–12:00")
const LABEL_GAP_PX = 6;

/**
 * Where each range block's label goes under a lane `widthPx` wide: left to right,
 * line 0 unless it would overlap the previous label there, then line 1; when it
 * fits on neither (max 2 lines) it is hidden (the block keeps a tooltip).
 * Labels stay inside the lane (shifted left at the right edge).
 * @param {{ id, mode, start, end }[]} entries  hours-only entries get no label
 * @returns {{ id: string, text: string, x: number, line: 0|1|null }[]} line null = hidden
 */
export function layoutLaneLabels(entries, widthPx, { charPx = LABEL_CHAR_PX, gapPx = LABEL_GAP_PX, maxLines = 2 } = {}) {
  const ends = Array(maxLines).fill(-Infinity);
  return entries
    .filter((e) => e.mode === "range")
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .map((e) => {
      const text = entryLabel(e);
      const w = text.length * charPx;
      const x = Math.max(0, Math.min((toMin(e.start) / DAY_MIN) * widthPx, widthPx - w));
      const line = ends.findIndex((end) => x >= end + gapPx);
      if (line < 0) return { id: e.id, text, x, line: null };
      ends[line] = x + w;
      return { id: e.id, text, x, line };
    });
}

// ── People ────────────────────────────────────────────────────────────────

/**
 * Who has a Work Plan on a task (ids, main assignee first):
 *   clip / graphic / post / article  the assignee
 *   photo                            Camera Man (assignee) + Editor (details.editor)
 *   production                       every Videographer (presenters: no)
 */
export function workPlanPeople(task) {
  const d = task?.details ?? {};
  let ids;
  if (task?.type === "production") ids = d.videographers ?? [];
  else if (task?.type === "photo") ids = [task.assignee, d.editor];
  else ids = [task?.assignee];
  return [...new Set(ids.filter(Boolean).map(String))];
}

/** May this viewer write `personId`'s plans / logs? Their own, or full access on behalf. */
export function canWriteFor(personId, { viewerId, fullAccess = false, people = [] }) {
  if (!people.includes(String(personId))) return { ok: false };
  if (String(personId) === String(viewerId)) return { ok: true, onBehalf: false };
  return fullAccess ? { ok: true, onBehalf: true } : { ok: false };
}
