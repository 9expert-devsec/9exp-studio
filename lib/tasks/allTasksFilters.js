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
//
// Round 58 — SCOPE. The same state, loader and components serve two pages:
//   all   /all-tasks     every visible task (the tabs above)
//   mine  /my-workspace  only tasks I WORK on (lib/tasks/myWorkspace.js isMine;
//                        reviewers never), never cancelled / stopped:
//     ws    done                                (absent = งานของฉัน: still open)
//     tab   open: overdue | today | week        (absent = ทั้งหมด)
//           done: month | all                   (absent = สัปดาห์นี้, by COMPLETION time)
//     sort  open: as above · done: -done (default) | done | task | -task
//     no `who` (it is me), no stop-state chip, no ผู้รับผิดชอบ grouping; the done
//     tab has no status / due rows, no กลุ่มสถานะ grouping and no calendar.
// The scope is the page's (server: parseAllTasks(params, scope); client:
// useAllTasksState() reads it from the pathname), never a URL param.

import { STOPPED_STAGE, TASK_STAGE_KEYS, TASK_TYPE_KEYS } from "./types.js";

export const ALL_TASKS_PATH = "/all-tasks";
export const MY_WORKSPACE_PATH = "/my-workspace";
const SCOPE_PATH = { all: ALL_TASKS_PATH, mine: MY_WORKSPACE_PATH };
/** The scope of a page path ("mine" for /my-workspace, else "all"). */
export const scopeOfPath = (pathname) => (String(pathname ?? "").startsWith(MY_WORKSPACE_PATH) ? "mine" : "all");
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
const DONE_SORTS = ["-done", "done", "task", "-task"];
const STAGE_FILTER_KEYS = [...TASK_STAGE_KEYS, STOPPED_STAGE.key];
/** The open stages (My Workspace งานของฉัน: its status chips). */
export const OPEN_STAGE_KEYS = TASK_STAGE_KEYS.filter((k) => k !== "done");

// ── My Workspace (round 58) ──
export const MY_TABS = [
  { key: "open", label: "งานของฉัน" },
  { key: "done", label: "งานที่เสร็จแล้ว" },
];
export const MY_OPEN_CHIPS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "overdue", label: "เลยกำหนด" },
  { key: "today", label: "วันนี้" },
  { key: "week", label: "ครบกำหนดสัปดาห์นี้" },
];
export const MY_DONE_CHIPS = [
  { key: "week", label: "สัปดาห์นี้" },
  { key: "month", label: "เดือนนี้" },
  { key: "all", label: "ทั้งหมด" },
];
const isMineDone = (f) => f.scope === "mine" && f.ws === "done";

/** The tab chips of a state (All Tasks tabs · My Workspace chips of its tab). */
export const chipsFor = (f) => (f.scope !== "mine" ? ALL_TASKS_TABS : f.ws === "done" ? MY_DONE_CHIPS : MY_OPEN_CHIPS);
/** The tab chip shown when the URL has none. */
export const defaultTab = (f) => (isMineDone(f) ? "week" : "all");
/** The sort used when the URL has none. */
export const defaultSort = (f) => (isMineDone(f) ? "-done" : "due");
/** จัดกลุ่ม options. */
export const groupsFor = (f) =>
  f.scope !== "mine"
    ? ALL_TASKS_GROUPS
    : ALL_TASKS_GROUPS.filter((g) => g.key !== "assignee" && !(f.ws === "done" && g.key === "stage"));
/** Filter-modal rows shown: status chips (their keys), Due, ผู้รับผิดชอบ. */
export const modalRows = (f) =>
  f.scope !== "mine"
    ? { stages: STAGE_FILTER_KEYS, due: true, who: true }
    : f.ws === "done"
      ? { stages: null, due: false, who: false }
      : { stages: OPEN_STAGE_KEYS, due: true, who: false };
/** The page path of a state. */
export const scopePath = (f) => SCOPE_PATH[f?.scope] ?? ALL_TASKS_PATH;
/** path + "?…" for a state change (same options as allTasksQuery). */
export const tasksHref = (f, changes = {}, opts = {}) => `${scopePath(f)}${allTasksQuery(f, changes, opts)}`;

const first = (v) => (Array.isArray(v) ? v[0] : v);
const isId = (v) => /^[a-f0-9]{24}$/i.test(String(v ?? ""));
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const list = (v, allowed) => {
  const set = new Set(String(first(v) ?? "").split(",").filter((x) => allowed.includes(x)));
  return allowed.filter((x) => set.has(x)); // canonical order, no duplicates
};

/**
 * @param {Record<string, string | string[] | undefined> | URLSearchParams} params
 * @param {"all" | "mine"} [scope] the page's scope (round 58)
 */
export function parseAllTasks(params = {}, scope = "all") {
  const p = params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;
  const mine = scope === "mine";
  const ws = mine && first(p.ws) === "done" ? "done" : "open";
  const base = { scope: mine ? "mine" : "all", ws };
  const tab = chipsFor(base).some((t) => t.key === first(p.tab)) ? first(p.tab) : defaultTab(base);
  const q = String(first(p.q) ?? "").trim().slice(0, ALL_TASKS_SEARCH_MAX);
  let due = ALL_TASKS_DUE.some((d) => d.key && d.key === first(p.due)) ? first(p.due) : "";
  let from = isDay(first(p.from)) ? first(p.from) : "";
  let to = isDay(first(p.to)) ? first(p.to) : "";
  if (due !== "custom") from = to = "";
  else if (!from && !to) due = "";
  else if (from && to && from > to) [from, to] = [to, from];
  if (isMineDone(base)) due = from = to = "";
  const who = !mine && (first(p.who) === "me" || isId(first(p.who))) ? first(p.who) : "";
  const group = groupsFor(base).some((g) => g.key && g.key === first(p.group)) ? first(p.group) : "";
  const sort = (isMineDone(base) ? DONE_SORTS : SORTS).includes(first(p.sort)) ? first(p.sort) : defaultSort(base);
  const page = Math.max(1, Math.min(10000, Number.parseInt(first(p.page), 10) || 1));
  const view = first(p.view) === "calendar" && !isMineDone(base) ? "calendar" : "table";
  const rows = modalRows(base);
  return {
    ...base,
    view,
    cal: first(p.cal) === "week" ? "week" : "month",
    date: isDay(first(p.date)) ? first(p.date) : "",
    dueOnly: first(p.dueOnly) === "1",
    tab,
    q,
    types: list(p.type, TASK_TYPE_KEYS),
    stages: rows.stages ? list(p.sg, rows.stages) : [],
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
export const hasNarrowing = (f) => !!f.q || f.tab !== defaultTab(f) || activeFilterCount(f) > 0;
/** The "ล้างตัวกรอง" target: no search, no modal filters, the default chip. */
export const clearedFilters = (f) => ({ ...EMPTY_MODAL_FILTERS, q: "", tab: defaultTab(f) });

/**
 * "?…" for a state (defaults omitted). Page resets to 1 unless `keepPage`.
 * @param {ReturnType<typeof parseAllTasks>} f @param {Partial<ReturnType<typeof parseAllTasks>>} [changes]
 */
export function allTasksQuery(f, changes = {}, { keepPage = false, extra = {} } = {}) {
  const n = { ...f, ...changes };
  const sp = new URLSearchParams();
  // Switching the My Workspace tab: its chip, sort and grouping start fresh.
  if ("ws" in changes && changes.ws !== f.ws) Object.assign(n, { tab: "", sort: "", group: "", view: "table", stages: [], due: "" });
  if (n.scope === "mine" && n.ws === "done") sp.set("ws", "done");
  if (n.view === "calendar" && !(n.scope === "mine" && n.ws === "done")) {
    sp.set("view", "calendar");
    if (n.cal === "week") sp.set("cal", "week");
    if (n.date) sp.set("date", n.date);
    if (n.dueOnly) sp.set("dueOnly", "1");
  }
  if (n.tab && n.tab !== defaultTab(n)) sp.set("tab", n.tab);
  if (n.q) sp.set("q", n.q);
  if (n.types?.length) sp.set("type", n.types.join(","));
  if (n.stages?.length) sp.set("sg", n.stages.join(","));
  if (n.due) sp.set("due", n.due);
  if (n.due === "custom" && n.from) sp.set("from", n.from);
  if (n.due === "custom" && n.to) sp.set("to", n.to);
  if (n.project) sp.set("project", n.project);
  if (n.who && n.scope !== "mine") sp.set("who", n.who);
  if (n.group) sp.set("group", n.group);
  if (n.sort && n.sort !== defaultSort(n)) sp.set("sort", n.sort);
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

/** The completion-time window of a My Workspace done chip { from?, to? } (to exclusive), or null (ทั้งหมด). */
export function doneWindow(chip, todayKey) {
  if (chip === "week" || chip === "month") return dueWindow(chip, {}, todayKey);
  return null;
}
