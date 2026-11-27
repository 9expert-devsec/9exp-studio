// Production shoot sessions ("นัดถ่าย", round 57.1) — pure rules (no DB, no React).
// Shared by the Edit / Create form, the Task Detail dialog + left column, the
// server actions (task-actions.js), the linked Work Plan sync
// (lib/tasks/shootPlanStore.js), the All Tasks calendar and node checks.
//
// Stored on the task as details.shootSessions:
//   [{ _id: "<24 hex>", date: "YYYY-MM-DD", startTime: "HH:mm", endTime: "HH:mm" | null, location: "" }]
// sorted by date, then start time. endTime < startTime = the session ends the NEXT
// day ("22:00–02:00 (+1 วัน)"); there is no end-date field. A task saved before
// round 57.1 may still hold the single details.shoot { date, time, location }:
// sessionsFromDetails() reads it as one session without an end time
// (scripts/migrate-shoot-sessions.mjs converts it for good).
//
// Linked Work Plan (Production only): every session WITH an end time gives each
// Studio person of the task (every Videographer + every Presenter who is an
// account; typed external names get nothing) one planned block from start to end.
// An overnight session is split at midnight into two day blocks (part 0: start–24:00
// on the session date, part 1: 00:00–end on the next day; none when it ends at 00:00).

import { addDays, isDateStr, toMin } from "./workplan.js";

export const SESSIONS_MAX = 31;
export const SESSION_LOCATION_MAX = 200;
export const SHOOT_PLAN_SOURCE = "shootSession";
/** Default time of an auto-filled Due (the last session's day). */
export const AUTO_DUE_TIME = "18:00";
export const NO_END_HINT = "ใส่เวลาจบเพื่อสร้างแผนใน Work Plan อัตโนมัติ";
const LEGACY_ID = "legacy-shoot";
const HEX24 = /^[0-9a-f]{24}$/i;

const s = (v) => (typeof v === "string" ? v.trim() : "");
const idOf = (v) => (v ? String(v) : "");

/** Date, then start time (stable: same input order on ties). */
export const sortSessions = (list) =>
  [...(list ?? [])].sort((a, b) => (a.date === b.date ? String(a.startTime).localeCompare(String(b.startTime)) : a.date < b.date ? -1 : 1));

/** Ends the next day? (an end time earlier than the start time) */
export const isOvernight = (x) => !!x?.endTime && toMin(x.endTime) < toMin(x.startTime);

/** "09:00–12:00" · "22:00–02:00 (+1 วัน)" · "09:00" (no end time). */
export function sessionTimeLabel(x) {
  if (!x?.startTime) return "";
  if (!x.endTime) return x.startTime;
  return `${x.startTime}–${x.endTime}${isOvernight(x) ? " (+1 วัน)" : ""}`;
}

/**
 * A task's sessions, sorted, as plain values (ids as strings). Falls back to the
 * pre-57.1 single `details.shoot` (one session, no end time) when no list is stored.
 */
export function sessionsFromDetails(details) {
  const d = details ?? {};
  if (Array.isArray(d.shootSessions)) {
    return sortSessions(
      d.shootSessions
        .filter((x) => x && isDateStr(x.date) && toMin(x.startTime) != null)
        .map((x) => ({
          _id: idOf(x._id),
          date: x.date,
          startTime: x.startTime,
          endTime: toMin(x.endTime) != null ? x.endTime : null,
          location: typeof x.location === "string" ? x.location : "",
        }))
    );
  }
  const old = d.shoot;
  if (old && isDateStr(old.date) && toMin(old.time) != null) {
    return [{ _id: LEGACY_ID, date: old.date, startTime: old.time, endTime: null, location: typeof old.location === "string" ? old.location : "" }];
  }
  return [];
}

/** The legacy single appointment → its session (migration + read fallback). */
export const sessionFromLegacyShoot = (shoot, id) =>
  shoot && isDateStr(shoot.date) && toMin(shoot.time) != null
    ? { _id: id, date: shoot.date, startTime: shoot.time, endTime: null, location: typeof shoot.location === "string" ? shoot.location : "" }
    : null;

/**
 * Posted rows → { value: sorted sessions } or { errors: { "shootSessions.<i>.<field>": msg, shootSessions?: msg } }.
 * Row: { _id?, date, startTime, endTime, location }. Date + start are required,
 * end + location optional; an end equal to the start is refused. A posted _id is
 * kept only when it is one of `storedIds` (else the row is new: `newId()`).
 * Error indexes are the POSTED row order (the form's order).
 * @param {unknown} raw
 * @param {{ storedIds?: Iterable<string>, newId: () => string }} ctx
 */
export function parseShootSessions(raw, { storedIds = [], newId }) {
  const rows = Array.isArray(raw) ? raw : [];
  const errors = {};
  if (rows.length > SESSIONS_MAX) return { errors: { shootSessions: `ไม่เกิน ${SESSIONS_MAX} วันถ่าย` } };
  const keep = new Set([...storedIds].map(String));
  const used = new Set();
  const value = [];
  rows.forEach((r, i) => {
    const key = (f) => `shootSessions.${i}.${f}`;
    const date = s(r?.date);
    const startTime = s(r?.startTime);
    const endTime = s(r?.endTime);
    const location = s(r?.location);
    if (!isDateStr(date)) errors[key("date")] = "เลือกวันที่ถ่าย";
    if (toMin(startTime) == null) errors[key("startTime")] = "ใส่เวลาเริ่ม (เช่น 09:00)";
    if (endTime && toMin(endTime) == null) errors[key("endTime")] = "รูปแบบเวลาไม่ถูกต้อง (เช่น 17:00)";
    else if (endTime && endTime === startTime) errors[key("endTime")] = "เวลาจบต้องไม่ตรงกับเวลาเริ่ม";
    if (location.length > SESSION_LOCATION_MAX) errors[key("location")] = `ไม่เกิน ${SESSION_LOCATION_MAX} ตัวอักษร`;
    const posted = idOf(r?._id);
    const _id = posted && keep.has(posted) && !used.has(posted) ? posted : newId();
    used.add(_id);
    value.push({ _id, date, startTime, endTime: endTime || null, location });
  });
  return Object.keys(errors).length ? { errors } : { value: sortSessions(value) };
}

/** Same sessions (ids ignored)? For the Activity diff. */
export const sameSessions = (a, b) => {
  const k = (list) => JSON.stringify(sortSessions(list).map((x) => [x.date, x.startTime, x.endTime ?? null, x.location ?? ""]));
  return k(a) === k(b);
};

// ── Status + Due side effects ─────────────────────────────────────────────

/**
 * The automatic status after a save: Production at ยังไม่เริ่ม that gets its FIRST
 * session(s) → นัดถ่ายแล้ว. Never back (removing every session keeps the status),
 * never from any later status. null = no change.
 */
export function autoStatusForSessions(type, status, beforeCount, afterCount) {
  if (type !== "production" || status !== "not_started") return null;
  return beforeCount === 0 && afterCount > 0 ? "scheduled" : null;
}

/**
 * The Due DAY to fill in when the task has none: the LAST session's date (18:00
 * Bangkok is added by the caller). null when Due is set, there are no sessions,
 * or the day would be before the start day (Due must not be before Start).
 * @param {{ sessions: object[], hasDue: boolean, startDay?: string|null }} t
 */
export function autoDueDay({ sessions, hasDue, startDay = null }) {
  if (hasDue || !sessions?.length) return null;
  const last = sortSessions(sessions).at(-1).date;
  return startDay && last < startDay ? null : last;
}

// ── Linked Work Plan ──────────────────────────────────────────────────────

/** Studio people of a Production: every Videographer + every account Presenter (ids, deduped, videographers first). */
export function productionStudioPeople(details) {
  const d = details ?? {};
  const ids = [...(d.videographers ?? []), ...(d.presenters ?? []).filter((p) => p?.kind === "user" && p.id).map((p) => p.id)];
  return [...new Set(ids.filter(Boolean).map(String))];
}

/**
 * The day blocks of one session: [] without an end time; one block same-day;
 * an overnight session split at midnight (the second part only when it ends after 00:00).
 * @returns {{ part: 0|1, date: string, start: string, end: string, minutes: number }[]}
 */
export function sessionPlanPieces(x) {
  if (!x?.endTime || toMin(x.startTime) == null || toMin(x.endTime) == null || x.endTime === x.startTime) return [];
  const piece = (part, date, start, end) => ({ part, date, start, end, minutes: toMin(end) - toMin(start) });
  if (!isOvernight(x)) return [piece(0, x.date, x.startTime, x.endTime)];
  const out = [piece(0, x.date, x.startTime, "24:00")];
  if (x.endTime !== "00:00") out.push(piece(1, addDays(x.date, 1), "00:00", x.endTime));
  return out;
}

const planKey = (p) => `${p.sessionId}|${p.person}|${p.part}`;

/** Every linked plan the task SHOULD have now: session × Studio person × day block. */
export function desiredShootPlans(details) {
  const people = productionStudioPeople(details);
  const out = [];
  for (const x of sessionsFromDetails(details)) {
    if (x._id === LEGACY_ID) continue; // not converted yet (no end time anyway)
    for (const piece of sessionPlanPieces(x)) for (const person of people) out.push({ sessionId: x._id, person, ...piece });
  }
  return out;
}

/**
 * What to write so the stored linked plans match `desired`. Matched by session +
 * person + part: a changed date / time is an UPDATE (the plan keeps its id), a
 * plan with no match is removed, a missing one inserted. Hand-made plans are never
 * in `existing` (the caller reads source = shootSession only).
 * @param {{ sessionId, person, part, date, start, end, minutes }[]} desired
 * @param {{ id, sessionId, person, sessionPart, date, start, end }[]} existing
 * @returns {{ insert: object[], update: { id, set: object }[], remove: string[] }}
 */
export function diffShootPlans(desired, existing) {
  const want = new Map(desired.map((p) => [planKey(p), p]));
  const insert = [];
  const update = [];
  const remove = [];
  const seen = new Set();
  for (const e of existing) {
    const k = planKey({ sessionId: String(e.sessionId), person: String(e.person), part: e.sessionPart ?? 0 });
    const p = want.get(k);
    if (!p || seen.has(k)) {
      remove.push(String(e.id));
      continue;
    }
    seen.add(k);
    if (p.date !== e.date || p.start !== e.start || p.end !== e.end || e.mode !== "range") {
      update.push({ id: String(e.id), set: { date: p.date, mode: "range", start: p.start, end: p.end, minutes: p.minutes } });
    }
  }
  for (const [k, p] of want) if (!seen.has(k)) insert.push(p);
  return { insert, update, remove };
}

// ── Work Plan rights by status (Production) ───────────────────────────────

export const PLAN_LOCKED_MESSAGE = {
  done: "งานเสร็จสมบูรณ์แล้ว · แก้แผนไม่ได้",
  cancelled: "Task ถูกยกเลิก · แก้แผนไม่ได้",
};
export const LOG_LOCKED_MESSAGE = {
  done: "งานเสร็จสมบูรณ์แล้ว · แก้เวลาจริงได้เฉพาะ Manager",
  cancelled: "Task ถูกยกเลิก · บันทึกเวลาไม่ได้",
};

/**
 * Production Work Plan rights by status (round 57.1):
 *   ยังไม่เริ่ม     plan ✓   log ✗ (the "หลังเริ่มงาน" rule)
 *   นัดถ่ายแล้ว     plan ✓   log ✓   (log unlocks here)
 *   ถ่ายแล้ว        plan ✓   log ✓
 *   เสร็จสมบูรณ์   plan ✗   log Manager / superadmin only (corrections)
 *   ยกเลิก          plan ✗   log ✗
 * Other types: no status lock here (their own rules apply). `log` here is the
 * status rule only; the "has started" rule (workplanStore taskStarted) still applies.
 * @returns {{ plan: boolean, log: boolean, planMessage: string|null, logMessage: string|null }}
 */
export function workRightsByStatus(type, status, { fullAccess = false } = {}) {
  const open = { plan: true, log: true, planMessage: null, logMessage: null };
  if (type !== "production") return open;
  if (status === "done") return { plan: false, log: !!fullAccess, planMessage: PLAN_LOCKED_MESSAGE.done, logMessage: fullAccess ? null : LOG_LOCKED_MESSAGE.done };
  if (status === "cancelled") return { plan: false, log: false, planMessage: PLAN_LOCKED_MESSAGE.cancelled, logMessage: LOG_LOCKED_MESSAGE.cancelled };
  return open;
}

/**
 * "บันทึกตามแผน": the person's RANGE plans of that day become log rows with the
 * same times (overlapping / touching plans merged, so the rows never overlap).
 */
export function plannedRowsForDay(plans, person, date) {
  const list = (plans ?? [])
    .filter((p) => String(p.person) === String(person) && p.date === date && p.kind === "plan" && p.mode === "range")
    .map((p) => [toMin(p.start), toMin(p.end)])
    .filter(([a, b]) => a != null && b != null && b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const [a, b] of list) {
    const last = merged.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return merged.map(([a, b]) => ({ start: hhmm(a), end: hhmm(b) }));
}

/** A 24-hex id (session ids are ObjectId strings). */
export const isHexId = (v) => HEX24.test(String(v ?? ""));
