// My Workspace (round 58) — pure rules (no DB, no React). Shared by the loader
// (lib/tasks/allTasks.js scope "mine", lib/tasks/myWorkspaceStore.js), the page
// cards and node checks.
//
// "Mine" = I WORK on the task (reviewers never — their work is the รอฉันตรวจ card):
//   the main assignee (any type; Article's Writer IS the assignee, no separate field)
//   any Production Videographer (details.videographers)
//   a Production Presenter who is an account (details.presenters { kind: "user", id })
//   the Photo Editor (details.editor)
// The Mongo form of the same rule: allTasks.js personClause.

import { formatThaiDay } from "../projects/format.js";
import { daySummary, formatDuration } from "./workplan.js";

const idOf = (v) => (v ? String(v) : "");
const same = (a, b) => !!a && !!b && idOf(a) === idOf(b);

/** Am I a worker on this task? */
export function isMine(task, viewerId) {
  const d = task?.details ?? {};
  if (same(task?.assignee, viewerId)) return true;
  if (task?.type === "production") {
    if ((d.videographers ?? []).some((v) => same(v, viewerId))) return true;
    if ((d.presenters ?? []).some((p) => p?.kind === "user" && same(p.id, viewerId))) return true;
  }
  return task?.type === "photo" && same(d.editor, viewerId);
}

/**
 * บทบาทของฉัน: the most specific role on line 1, its detail + "+other roles" on line 2.
 * Specificity: Editor › Videographer (not the first) › Presenter › ผู้รับผิดชอบ
 * (the first Videographer IS the assignee → ผู้รับผิดชอบ).
 * @param {object} task  { type, assignee, details }
 * @param {string} viewerId
 * @param {(id: unknown) => string} nameOf  a user id → display name
 * @returns {{ label: string, sub: string } | null}
 */
export function myRole(task, viewerId, nameOf = () => "") {
  const d = task?.details ?? {};
  const roles = [];
  const vids = (d.videographers ?? []).map(idOf);
  const lead = vids[0] && vids[0] !== idOf(viewerId) ? nameOf(vids[0]) : ""; // never "หลัก: me"
  if (task?.type === "photo" && same(d.editor, viewerId) && !same(task.assignee, viewerId)) {
    roles.push({ label: "Editor", sub: task.assignee ? `ช่างภาพ: ${nameOf(task.assignee)}` : "" });
  }
  if (task?.type === "production") {
    const i = vids.indexOf(idOf(viewerId));
    if (i > 0) roles.push({ label: "Videographer", sub: `คนที่ ${i + 1}${lead ? ` · หลัก: ${lead}` : ""}` });
    if ((d.presenters ?? []).some((p) => p?.kind === "user" && same(p.id, viewerId))) roles.push({ label: "Presenter", sub: lead ? `หลัก: ${lead}` : "" });
  }
  if (same(task?.assignee, viewerId)) roles.push({ label: "ผู้รับผิดชอบ", sub: "" });
  if (!roles.length) return null;
  const [main, ...rest] = roles;
  const more = rest.length ? `+${rest.map((r) => r.label).join(", ")}` : "";
  return { label: main.label, sub: [main.sub, more].filter(Boolean).join(" · ") };
}

// ── Today's Work Plan (the card) ─────────────────────────────────────────

/**
 * Today's totals of MY entries (plans + logs of every task, already one Bangkok
 * day — overnight linked plans are stored per day, round 57.1).
 * @param {{ kind: "plan"|"log", mode, start, end, minutes }[]} entries
 */
export function todayTotals(entries) {
  const plans = (entries ?? []).filter((e) => e.kind === "plan");
  const logs = (entries ?? []).filter((e) => e.kind === "log");
  const { plannedMin, actualMin } = daySummary(plans, logs);
  return { plannedMin, actualMin, planLabel: formatDuration(plannedMin, { compact: true }), actualLabel: formatDuration(actualMin, { compact: true }), empty: !plans.length && !logs.length };
}

/** "แผนวันนี้ N ช่วง": my plan blocks today per task id. */
export function planCountsByTask(entries) {
  const out = new Map();
  for (const e of entries ?? []) if (e.kind === "plan") out.set(idOf(e.task), (out.get(idOf(e.task)) ?? 0) + 1);
  return out;
}


// ── รอฉันตรวจ ─────────────────────────────────────────────────────────────

const REVIEW_TITLE = { present: "Content Review", video: "Video Review", design: "Design Review" };
export const reviewTitle = (key) => REVIEW_TITLE[key] ?? "Review";

/**
 * Reviews waiting for MY verdict: open cycles whose section is assigned to me and
 * still pending. The latest = the most recent assignment (or the cycle's submit).
 * @param {{ status: string, submittedAt: unknown, sections: { key, reviewerId, verdict, assignedAt? }[] }[]} reviews
 * @returns {{ count: number, latest: { key: string, at: Date } | null }}
 */
export function pendingReviews(reviews, viewerId) {
  let count = 0;
  let latest = null;
  for (const r of reviews ?? []) {
    if (r?.status !== "open") continue;
    for (const s of r.sections ?? []) {
      if (s?.verdict !== "pending" || !same(s.reviewerId, viewerId)) continue;
      count += 1;
      const at = new Date(s.assignedAt ?? r.submittedAt);
      if (!latest || at > latest.at) latest = { key: s.key, at };
    }
  }
  return { count, latest };
}

// ── Labels ────────────────────────────────────────────────────────────────

const BKK_MS = 7 * 3600 * 1000;
const bkkKey = (v) => new Date(new Date(v).getTime() + BKK_MS).toISOString().slice(0, 10);
const bkkHHmm = (v) => new Date(new Date(v).getTime() + BKK_MS).toISOString().slice(11, 16);
const prevDay = (key) => new Date(Date.parse(`${key}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

/** "วันนี้ 09:12" · "เมื่อวาน 17:05" · "25 พ.ย. 17:05" (Bangkok). */
export function relativeDayTime(value, todayKey) {
  const key = bkkKey(value);
  const day = key === todayKey ? "วันนี้" : key === prevDay(todayKey) ? "เมื่อวาน" : formatThaiDay(key, { weekday: false });
  return `${day} ${bkkHHmm(value)}`;
}

/** "รอฉันตรวจ" sub-line. */
export const reviewSubline = (pending, todayKey) =>
  pending.latest ? `${reviewTitle(pending.latest.key)} · ล่าสุด ${relativeDayTime(pending.latest.at, todayKey)}` : "ไม่มีงานรอตรวจ";

const thaiLong = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { weekday: "long", timeZone: "UTC" });
const thaiShortMonth = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { month: "short", timeZone: "UTC" });
const thaiShortDay = new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "UTC" });
const asDate = (key) => new Date(`${key}T12:00:00Z`);

/** "งานของคุณดี · ศุกร์ 27 พ.ย. 2569" — the Buddhist year here (Figma), weekday without "วัน". */
export function workspaceSubtitle(name, todayKey) {
  const d = asDate(todayKey);
  const weekday = thaiLong.format(d).replace(/^วัน/, "");
  const year = Number(todayKey.slice(0, 4)) + 543;
  return `งานของ${name} · ${weekday} ${Number(todayKey.slice(8, 10))} ${thaiShortMonth.format(d)} ${year}`;
}

/** "ศ. 27 พ.ย." — the Work Plan card date. */
export const cardDay = (todayKey) => `${thaiShortDay.format(asDate(todayKey))} ${Number(todayKey.slice(8, 10))} ${thaiShortMonth.format(asDate(todayKey))}`;

/** Today's Bangkok day "YYYY-MM-DD" (call after connection(): per request). */
export const bangkokToday = () => bkkKey(Date.now());
