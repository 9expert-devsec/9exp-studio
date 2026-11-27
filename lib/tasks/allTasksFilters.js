// All Tasks (round 56) — URL state, pure (no DB). Shared by the server page, the
// server actions and the client toolbar / filter modal. EVERYTHING lives in the
// URL and is derived from it on every render (never copied into state):
//
//   tab    overdue | week | done                  (absent = ทั้งหมด)
//   q      search: task name, task ID (Folder ID / "TASK 03") or project name
//   type   clip,graphic,…                         (task types, multi)
//   sg     not_started,doing,…,stopped           (stages, multi; absent = the 5 stages)
//   due    overdue | today | week | month | custom  (+ from / to "YYYY-MM-DD" for custom)
//   project <projectId>       who  me | <userId>  (anyone ON the task; reviewers never)
//   group  project | type | assignee | stage      (absent = no grouping)
//   sort   due | -due | task | -task              (absent = due ascending, no-due last)
//   page   1-based
//   view   calendar                               (absent = table)        — round 57
//   cal    week                                   (absent = month)
//   date   "YYYY-MM-DD" anchor day of the period  (absent = today, Bangkok)
//   dueOnly 1                                     (month: one marker per task on its Due)
// Any change except `page` itself resets page to 1 (allTasksQuery's `keepPage`).
// The calendar ignores `group` and `page` (kept in the URL for the way back).

import { STOPPED_STAGE, TASK_STAGE_KEYS, TASK_TYPE_KEYS } from "./types.js";

export const ALL_TASKS_PATH = "/all-tasks";
export const ALL_TASKS_PAGE_SIZE = 25;
export const ALL_TASKS_SEARCH_MAX = 100;

export const ALL_TASKS_TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "overdue", label: "เลยกำหนด" },
  { key: "week", label: "ครบกำหนดสัปดาห์นี้" },
  { key: "done", label: "เสร็จแล้ว" },
];
export const ALL_TASKS_GROUPS = [
  { key: "", label: "ไม่มี" },
  { key: "project", label: "โปรเจกต์" },
  { key: "type", label: "ประเภท" },
  { key: "assignee", label: "ผู้รับผิดชอบ" },
  { key: "stage", label: "กลุ่มสถานะ" },
];
export const ALL_TASKS_DUE = [
  { key: "", label: "ทั้งหมด" },
  { key: "overdue", label: "เลยกำหนด" },
  { key: "today", label: "วันนี้" },
  { key: "week", label: "สัปดาห์นี้" },
  { key: "month", label: "เดือนนี้" },
  { key: "custom", label: "กำหนดเอง…" },
];
const SORTS = ["due", "-due", "task", "-task"];
const STAGE_FILTER_KEYS = [...TASK_STAGE_KEYS, STOPPED_STAGE.key];

const first = (v) => (Array.isArray(v) ? v[0] : v);
const isId = (v) => /^[a-f0-9]{24}$/i.test(String(v ?? ""));
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const list = (v, allowed) => {
  const set = new Set(String(first(v) ?? "").split(",").filter((x) => allowed.includes(x)));
  return allowed.filter((x) => set.has(x)); // canonical order, no duplicates
};

/** @param {Record<string, string | string[] | undefined> | URLSearchParams} params */
export function parseAllTasks(params = {}) {
  const p = params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;
  const tab = ALL_TASKS_TABS.some((t) => t.key === first(p.tab)) ? first(p.tab) : "all";
  const q = String(first(p.q) ?? "").trim().slice(0, ALL_TASKS_SEARCH_MAX);
  let due = ALL_TASKS_DUE.some((d) => d.key && d.key === first(p.due)) ? first(p.due) : "";
  let from = isDay(first(p.from)) ? first(p.from) : "";
  let to = isDay(first(p.to)) ? first(p.to) : "";
  if (due !== "custom") from = to = "";
  else if (!from && !to) due = "";
  else if (from && to && from > to) [from, to] = [to, from];
  const who = first(p.who) === "me" || isId(first(p.who)) ? first(p.who) : "";
  const group = ALL_TASKS_GROUPS.some((g) => g.key && g.key === first(p.group)) ? first(p.group) : "";
  const sort = SORTS.includes(first(p.sort)) ? first(p.sort) : "due";
  const page = Math.max(1, Math.min(10000, Number.parseInt(first(p.page), 10) || 1));
  const view = first(p.view) === "calendar" ? "calendar" : "table";
  return {
    view,
    cal: first(p.cal) === "week" ? "week" : "month",
    date: isDay(first(p.date)) ? first(p.date) : "",
    dueOnly: first(p.dueOnly) === "1",
    tab,
    q,
    types: list(p.type, TASK_TYPE_KEYS),
    stages: list(p.sg, STAGE_FILTER_KEYS),
    due,
    from,
    to,
    project: isId(first(p.project)) ? first(p.project) : "",
    who,
    group,
    sort,
    page,
  };
}

/** The filter-modal part of the state (applied only by "แสดงผล N งาน"). */
export const modalFilters = (f) => ({ types: f.types, stages: f.stages, due: f.due, from: f.from, to: f.to, project: f.project, who: f.who });
export const EMPTY_MODAL_FILTERS = { types: [], stages: [], due: "", from: "", to: "", project: "", who: "" };

/** Number of active filter-modal rows (the badge on "ตัวกรอง"). */
export const activeFilterCount = (f) =>
  [f.types.length > 0, f.stages.length > 0, !!f.due, !!f.project, !!f.who].filter(Boolean).length;

/** Anything narrowing the list (search, modal, tab) → the empty state offers "ล้างตัวกรอง". */
export const hasNarrowing = (f) => !!f.q || f.tab !== "all" || activeFilterCount(f) > 0;

/**
 * "?…" for a state (defaults omitted). Page resets to 1 unless `keepPage`.
 * @param {ReturnType<typeof parseAllTasks>} f @param {Partial<ReturnType<typeof parseAllTasks>>} [changes]
 */
export function allTasksQuery(f, changes = {}, { keepPage = false, extra = {} } = {}) {
  const n = { ...f, ...changes };
  const sp = new URLSearchParams();
  if (n.view === "calendar") {
    sp.set("view", "calendar");
    if (n.cal === "week") sp.set("cal", "week");
    if (n.date) sp.set("date", n.date);
    if (n.dueOnly) sp.set("dueOnly", "1");
  }
  if (n.tab && n.tab !== "all") sp.set("tab", n.tab);
  if (n.q) sp.set("q", n.q);
  if (n.types?.length) sp.set("type", n.types.join(","));
  if (n.stages?.length) sp.set("sg", n.stages.join(","));
  if (n.due) sp.set("due", n.due);
  if (n.due === "custom" && n.from) sp.set("from", n.from);
  if (n.due === "custom" && n.to) sp.set("to", n.to);
  if (n.project) sp.set("project", n.project);
  if (n.who) sp.set("who", n.who);
  if (n.group) sp.set("group", n.group);
  if (n.sort && n.sort !== "due") sp.set("sort", n.sort);
  const page = keepPage || "page" in changes ? n.page : 1;
  if (page > 1) sp.set("page", String(page));
  for (const [k, v] of Object.entries(extra)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── Dates: Asia/Bangkok (UTC+7, no DST), calendar days as "YYYY-MM-DD" ─────────
const BKK_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** The Bangkok calendar day of an instant. */
export const bkkDayKey = (value) => new Date(new Date(value).getTime() + BKK_MS).toISOString().slice(0, 10);
/** The instant a Bangkok day starts. */
export const bkkDayStart = (key) => new Date(Date.parse(`${key}T00:00:00Z`) - BKK_MS);
export const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** Whole days from day `a` to day `b` (b − a). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/** Monday of `key`'s Mon–Sun week. */
export const weekStart = (key) => addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));

/**
 * The due window of a filter as instants { from?, to? } (to = exclusive), or
 * { overdue: true } ("before today", the tab's own rule applies), or null (no window).
 */
export function dueWindow(due, { from, to } = {}, todayKey) {
  if (due === "overdue") return { overdue: true };
  if (due === "today") return { from: bkkDayStart(todayKey), to: bkkDayStart(addDays(todayKey, 1)) };
  if (due === "week") {
    const mon = weekStart(todayKey);
    return { from: bkkDayStart(mon), to: bkkDayStart(addDays(mon, 7)) };
  }
  if (due === "month") {
    const m = todayKey.slice(0, 7);
    const next = new Date(Date.parse(`${m}-01T00:00:00Z`));
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from: bkkDayStart(`${m}-01`), to: bkkDayStart(next.toISOString().slice(0, 10)) };
  }
  if (due === "custom" && (from || to)) {
    return { ...(from ? { from: bkkDayStart(from) } : {}), ...(to ? { to: bkkDayStart(addDays(to, 1)) } : {}) };
  }
  return null;
}
