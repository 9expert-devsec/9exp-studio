// All Tasks read model (round 56) — server only. Filtering, sorting, grouping and
// paging all happen in MongoDB; only the 25 rows of the page are shaped.
//
// Visibility: ONLY tasks of projects the viewer may list — the SAME rule as the
// Projects list (lib/projects/access.js visibleProjectsFilter: admin = manager /
// superadmin sees all; others = owner or member). Every query below is scoped to
// those project ids; a ?project= outside them matches nothing.
//
// Stages ("กลุ่มสถานะ") come from the catalog (lib/tasks/types.js `stage`): a
// stage filter is turned into per-type status-key lists (legacy keys included).
// The stop states (ยกเลิก / หยุดดำเนินการ) have no stage and are hidden unless
// the "ยกเลิก/หยุด" chip is on.
//
// Grouping across pages: the flat list is sorted by the GROUP first (project
// name, catalog type order, assignee name, stage order), then by the chosen sort,
// and that list is paged. So each group is contiguous; a group cut by a page
// boundary shows its header again on the next page, marked "(ต่อ)". Group header
// numbers ("N งาน", "เลยกำหนด N", per-stage counts) are always for the WHOLE
// filtered group, not just the rows on this page.
//
// Calendar (round 57, loadAllTasksCalendar): no paging — every task that shows
// SOMETHING in the visible range (its bar, its overdue segment, a shoot
// appointment or a Post publish time), under the same visibility, tab, search and
// filters. Layout (lanes, clipping) is pure: lib/tasks/calendar.js.
//
// Round 58 — scope "mine" (My Workspace, lib/tasks/allTasksFilters.js): the SAME
// loader, narrowed to tasks I work on (personClause; reviewers never), open stages
// on งานของฉัน, the done stage on งานที่เสร็จแล้ว. The done tab's chips and sort use
// the COMPLETION time (completionStages): the type's stored stamp (Production
// flow.doneAt · Photo flow.readyAt · Article flow.publishedAt), else the latest
// Activity "status_changed" INTO a done status, else updatedAt. Rows get my role
// (lib/tasks/myWorkspace.js myRole) and today's plan count.

import "server-only";
import mongoose from "mongoose";
import { connection } from "next/server";
import Content from "@/models/Content";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";
import { visibleProjectsFilter } from "@/lib/projects/access";
import { formatThaiDay, taskIdLabel } from "@/lib/projects/format";
import { loadUsers, unknownUser } from "@/lib/projects/queries";
import { buildStatusStepper } from "./stepper";
import { barSpan, clipSpan, overdueSpan, visibleRange } from "./calendar";
import { otherPeopleCount } from "./production";
import { sessionsFromDetails } from "./shootSessions";
import { myRole } from "./myWorkspace";
import {
  STOPPED_STAGE,
  TASK_STAGES,
  TASK_STAGE_KEYS,
  TASK_TYPE_KEYS,
  getTaskType,
  statusInfo,
  statusKeysForStages,
  statusStage,
} from "./types";
import {
  ALL_TASKS_PAGE_SIZE,
  addDays,
  bkkDayKey,
  bkkDayStart,
  chipsFor,
  daysBetween,
  doneWindow,
  dueWindow,
  scopePath,
  allTasksQuery,
  weekStart,
} from "./allTasksFilters";

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const idOf = (v) => (v ? String(v) : "");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NOT_DONE = ["not_started", "doing", "waiting", "fix"];
const mineDone = (f) => f.scope === "mine" && f.ws === "done";
/** "?…&task=<id>" on the state's own page. */
const openHrefOf = (f, selfQuery, id) => `${scopePath(f)}${selfQuery ? `${selfQuery}&` : "?"}task=${id}`;

/** `{ $or: [{ type, status: { $in } }] }` for a set of stages ("stopped" included). */
function stageClause(stages) {
  const parts = statusKeysForStages(stages).map(({ type, statuses }) => ({ type, status: { $in: statuses } }));
  return parts.length ? { $or: parts } : { _id: null };
}

/** Anyone ON the task (reviewers never): assignee, videographers, account presenters, Photo editor. */
function personClause(userId) {
  const ids = [oid(userId), String(userId)];
  return {
    $or: [
      { assignee: { $in: ids } },
      { "details.videographers": { $in: ids } },
      { "details.presenters": { $elemMatch: { kind: "user", id: { $in: ids } } } },
      { type: "photo", "details.editor": { $in: ids } },
    ],
  };
}

/** Today's Bangkok day, per request (after connection(): never prerendered). */
async function today() {
  await connection();
  return bkkDayKey(Date.now());
}

/**
 * The visible projects + the match for everything EXCEPT the tab.
 * @returns {Promise<{ projects: object[], match: object, todayKey: string }>}
 */
async function baseMatch(viewer, f) {
  const [projects, todayKey] = await Promise.all([
    Project.find(visibleProjectsFilter(viewer)).select("name icon owner members").lean(),
    today(),
  ]);
  const visibleIds = projects.map((p) => p._id);
  const and = [];

  and.push({ project: { $in: f.project ? visibleIds.filter((id) => String(id) === f.project) : visibleIds } });
  if (f.types.length) and.push({ type: { $in: f.types } });
  if (f.scope === "mine") {
    // Round 58: my work only; never cancelled / stopped (no chip shows them here).
    and.push(personClause(viewer.idStr));
    and.push(stageClause(f.ws === "done" ? ["done"] : f.stages.length ? f.stages : NOT_DONE));
  } else and.push(stageClause(f.stages.length ? f.stages : TASK_STAGE_KEYS));

  const win = dueWindow(f.due, f, todayKey);
  if (win?.overdue) and.push({ dueAt: { $lt: bkkDayStart(todayKey) } }, stageClause(NOT_DONE));
  else if (win) and.push({ dueAt: { ...(win.from ? { $gte: win.from } : {}), ...(win.to ? { $lt: win.to } : {}) } });

  if (f.who) and.push(personClause(f.who === "me" ? viewer.idStr : f.who));

  if (f.q) {
    const rx = new RegExp(escapeRegex(f.q), "i");
    const or = [{ title: rx }, { folderId: rx }];
    const named = projects.filter((p) => rx.test(p.name ?? "")).map((p) => p._id);
    if (named.length) or.push({ project: { $in: named } });
    const num = /^(?:task\s*)?#?0*(\d{1,4})$/i.exec(f.q);
    if (num) or.push({ number: Number(num[1]) });
    and.push({ $or: or });
  }
  return { projects, match: { $and: and }, todayKey };
}

/** The tab's own clause (AND-ed with the base match). `today` (My Workspace): Due on today. */
function tabClause(tab, todayKey) {
  if (tab === "today") return { dueAt: { $gte: bkkDayStart(todayKey), $lt: bkkDayStart(addDays(todayKey, 1)) } };
  if (tab === "overdue") return { $and: [{ dueAt: { $lt: bkkDayStart(todayKey) } }, stageClause(NOT_DONE)] };
  if (tab === "week") {
    const mon = weekStart(todayKey);
    return { $and: [{ dueAt: { $gte: bkkDayStart(mon), $lt: bkkDayStart(addDays(mon, 7)) } }, stageClause(NOT_DONE)] };
  }
  if (tab === "done") return stageClause(["done"]);
  return null;
}
const withTab = (match, tab, todayKey) => {
  const t = tabClause(tab, todayKey);
  return t ? { $and: [match, t] } : match;
};

/** Done statuses of every type (legacy keys included). */
const DONE_KEYS = [...new Set(statusKeysForStages(["done"]).flatMap((x) => x.statuses))];
/** Adds `_doneAt` (the completion time) to each task — see the header. */
const completionStages = [
  {
    $lookup: {
      from: "task_activities",
      let: { t: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$task", "$$t"] }, type: "status_changed", "data.to": { $in: DONE_KEYS } } },
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
        { $project: { createdAt: 1 } },
      ],
      as: "_done",
    },
  },
  { $addFields: { _doneAt: { $ifNull: ["$flow.doneAt", "$flow.readyAt", "$flow.publishedAt", { $first: "$_done.createdAt" }, "$updatedAt"] } } },
];

/**
 * The aggregation stages that yield a TAB's tasks (round 58): a plain $match, or —
 * My Workspace งานที่เสร็จแล้ว — the completion time + its chip window.
 */
function tabPipeline(f, match, todayKey, tab = f.tab) {
  if (!mineDone(f)) return [{ $match: withTab(match, tab, todayKey) }];
  const win = doneWindow(tab, todayKey);
  return [{ $match: match }, ...completionStages, ...(win ? [{ $match: { _doneAt: { $gte: win.from, $lt: win.to } } }] : [])];
}
const countOf = async (stages) => (await Task.aggregate([...stages, { $count: "n" }]))[0]?.n ?? 0;

/** Live count for the filter modal ("แสดงผล N งาน"): the pending filters + current tab / search. */
export async function countAllTasks(viewer, f) {
  const { match, todayKey } = await baseMatch(viewer, f);
  return countOf(tabPipeline(f, match, todayKey));
}

// ── Grouping ─────────────────────────────────────────────────────────────────

/** A Mongo expression ranking each task by its group (sort key), or null (no grouping). */
async function groupRank(f, match, projects) {
  if (f.group === "project") {
    const ids = [...projects].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "th")).map((p) => p._id);
    return { rank: { $indexOfArray: [ids, "$project"] } };
  }
  if (f.group === "type") return { rank: { $indexOfArray: [TASK_TYPE_KEYS, "$type"] } };
  if (f.group === "stage") {
    const order = [...TASK_STAGE_KEYS, STOPPED_STAGE.key];
    const branches = order.flatMap((stage, i) =>
      statusKeysForStages([stage]).map(({ type, statuses }) => ({
        case: { $and: [{ $eq: ["$type", type] }, { $in: ["$status", statuses] }] },
        then: i,
      }))
    );
    return { rank: { $switch: { branches, default: order.length } } };
  }
  if (f.group === "assignee") {
    const raw = (await Task.distinct("assignee", match)).filter(Boolean);
    const users = await loadUsers(raw);
    const ids = raw
      .map((id) => ({ id, name: users.get(idOf(id))?.name ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name, "th"))
      .map((x) => x.id);
    // Unassigned last.
    return { rank: { $let: { vars: { i: { $indexOfArray: [ids, "$assignee"] } }, in: { $cond: [{ $lt: ["$$i", 0] }, 1e6, "$$i"] } } } };
  }
  return null;
}

/** Group key of a raw task doc ("" = unassigned / none). */
function groupKeyOf(group, t) {
  if (group === "project") return idOf(t.project);
  if (group === "type") return t.type;
  if (group === "assignee") return idOf(t.assignee);
  if (group === "stage") return statusStage(t.type, t.status) ?? STOPPED_STAGE.key;
  return "";
}

/** Whole-group totals: { [key]: { count, overdue, stages: { [stage]: n } } }. */
async function groupTotals(group, stages, todayKey) {
  const field = { project: "$project", type: "$type", assignee: "$assignee" }[group] ?? null;
  const rows = await Task.aggregate([
    ...stages,
    {
      $group: {
        _id: {
          k: field,
          type: "$type",
          status: "$status",
          od: { $and: [{ $ne: [{ $ifNull: ["$dueAt", null] }, null] }, { $lt: ["$dueAt", bkkDayStart(todayKey)] }] },
        },
        n: { $sum: 1 },
      },
    },
  ]);
  const totals = new Map();
  for (const { _id, n } of rows) {
    const stage = statusStage(_id.type, _id.status);
    const key = group === "stage" ? (stage ?? STOPPED_STAGE.key) : idOf(_id.k);
    if (!totals.has(key)) totals.set(key, { count: 0, overdue: 0, stages: {} });
    const g = totals.get(key);
    g.count += n;
    if (_id.od && stage && stage !== "done") g.overdue += n;
    if (stage) g.stages[stage] = (g.stages[stage] ?? 0) + n;
  }
  return totals;
}

// ── Rows ─────────────────────────────────────────────────────────────────────

/** "วันนี้" / "เลย N วัน" (overdue, not done / stopped) / "28 พ.ย." / "–". */
function dueView(dueAt, stage, todayKey) {
  if (!dueAt) return { label: "–", overdue: false };
  const key = bkkDayKey(dueAt);
  if (key === todayKey) return { label: "วันนี้", overdue: false };
  const late = daysBetween(key, todayKey);
  if (late > 0 && stage && stage !== "done") return { label: `เลย ${late} วัน`, overdue: true };
  return { label: formatThaiDay(key, { weekday: false, year: key.slice(0, 4) !== todayKey.slice(0, 4) }), overdue: false };
}

/** n/N on the type's drawn steps (stepper.js): null for a stop state. */
function stepOf(type, status) {
  const { steps, terminal } = buildStatusStepper(type, status);
  if (terminal) return null;
  const at = steps.findIndex((s) => s.state === "current" || s.state === "warning");
  const n = steps.every((s) => s.state === "complete") ? steps.length : at + 1;
  return { n: Math.max(0, n), total: steps.length };
}

/**
 * The All Tasks page data for a parsed state.
 * @param {object} viewer getProjectViewer() @param {ReturnType<import("./allTasksFilters").parseAllTasks>} f
 */
export async function loadAllTasks(viewer, f, { planCounts = null } = {}) {
  const { projects, match, todayKey } = await baseMatch(viewer, f);
  const counts = await tabCounts(f, match, todayKey);

  const total = counts[f.tab];
  const pages = Math.max(1, Math.ceil(total / ALL_TASKS_PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const tabMatch = withTab(match, f.tab, todayKey);
  const stages = tabPipeline(f, match, todayKey);

  const rank = f.group ? await groupRank(f, tabMatch, projects) : null;
  const dir = f.sort.startsWith("-") ? -1 : 1;
  const sort = {
    ...(rank ? { _g: 1 } : {}),
    ...(f.sort.endsWith("task") ? { title: dir } : f.sort.endsWith("done") ? { _doneAt: dir } : { _noDue: 1, dueAt: dir }),
    _id: 1,
  };
  // One row before / after the page tells whether its first / last group continues.
  const start = (page - 1) * ALL_TASKS_PAGE_SIZE;
  const skip = Math.max(0, start - 1);
  const docs = await Task.aggregate(
    [
      ...stages,
      {
        $addFields: {
          _noDue: { $cond: [{ $ifNull: ["$dueAt", false] }, 0, 1] },
          ...(rank ? { _g: rank.rank } : {}),
        },
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: ALL_TASKS_PAGE_SIZE + (start > 0 ? 2 : 1) },
      { $project: { title: 1, type: 1, status: 1, project: 1, content: 1, number: 1, folderId: 1, assignee: 1, dueAt: 1, details: 1, _doneAt: 1 } },
    ],
    { collation: { locale: "th" } }
  );
  const before = start > 0 ? docs.shift() : null;
  const after = docs.length > ALL_TASKS_PAGE_SIZE ? docs.pop() : null;

  const projectById = new Map(projects.map((p) => [idOf(p._id), p]));
  const mine = f.scope === "mine";
  // My Workspace roles name the Camera Man / first Videographer too.
  const roleIds = mine ? docs.flatMap((d) => [d.assignee, d.details?.videographers?.[0]]) : [];
  const [contents, users, totals] = await Promise.all([
    Content.find({ _id: { $in: docs.map((d) => d.content) } }).select("name").lean(),
    loadUsers([...docs.map((d) => d.assignee), ...roleIds]),
    f.group ? groupTotals(f.group, stages, todayKey) : null,
  ]);
  const nameOf = (id) => users.get(idOf(id))?.name ?? "Unknown";
  const contentName = new Map(contents.map((c) => [idOf(c._id), c.name]));
  const selfQuery = allTasksQuery(f, { page }, { keepPage: true });

  const rows = docs.map((t) => {
    const info = statusInfo(t.type, t.status);
    const stage = statusStage(t.type, t.status);
    const project = projectById.get(idOf(t.project));
    const id = idOf(t._id);
    return {
      id,
      title: t.title,
      type: t.type,
      typeLabel: getTaskType(t.type)?.label ?? t.type,
      code: taskIdLabel(t),
      projectId: idOf(t.project),
      projectName: project?.name ?? "",
      contentName: contentName.get(idOf(t.content)) ?? "",
      statusLabel: info.label,
      stage: stage ?? STOPPED_STAGE.key,
      step: stepOf(t.type, t.status),
      assignee: t.assignee ? (users.get(idOf(t.assignee)) ?? unknownUser(t.assignee)) : null,
      extra: otherPeopleCount(t),
      due: dueView(t.dueAt, stage, todayKey),
      groupKey: groupKeyOf(f.group, t),
      openHref: openHrefOf(f, selfQuery, id),
      ...(mine
        ? {
            role: myRole(t, viewer.idStr, nameOf),
            planToday: planCounts?.get(id) ?? 0,
            doneLabel: t._doneAt ? formatThaiDay(bkkDayKey(t._doneAt), { weekday: false, year: bkkDayKey(t._doneAt).slice(0, 4) !== todayKey.slice(0, 4) }) : "–",
          }
        : {}),
    };
  });

  // Consecutive rows of one group → one section (the list is sorted by group first).
  const groups = [];
  if (f.group) {
    const userIds = rows.filter((r) => r.groupKey && f.group === "assignee").map((r) => r.groupKey);
    const groupUsers = f.group === "assignee" ? await loadUsers(userIds) : new Map();
    for (const r of rows) {
      const last = groups.at(-1);
      if (last && last.key === r.groupKey) {
        last.rows.push(r);
        continue;
      }
      groups.push({ key: r.groupKey, label: groupLabel(f.group, r, projectById, groupUsers), totals: totals.get(r.groupKey) ?? null, rows: [r] });
    }
    if (groups.length) {
      groups[0].continued = !!before && groupKeyOf(f.group, before) === groups[0].key;
      groups.at(-1).continues = !!after && groupKeyOf(f.group, after) === groups.at(-1).key;
    }
  }

  return {
    counts,
    total,
    page,
    pages,
    from: total ? start + 1 : 0,
    to: start + rows.length,
    rows,
    groups,
    ...(await pickerOptions(projects, { people: !mine })),
  };
}

/** The tab chip counts of the state (each = base match AND that chip). */
async function tabCounts(f, match, todayKey) {
  const tabs = chipsFor(f).map((t) => t.key);
  return Object.fromEntries(await Promise.all(tabs.map(async (t) => [t, await countOf(tabPipeline(f, match, todayKey, t))])));
}

/**
 * My Workspace main tab counts: งานของฉัน (open stages) / งานที่เสร็จแล้ว (done), mine
 * in visible projects. Search and filters don't change them (each tab has its own).
 */
export async function myTabCounts(viewer) {
  const projects = await Project.find(visibleProjectsFilter(viewer)).select("_id").lean();
  const base = { project: { $in: projects.map((p) => p._id) } };
  const n = (stages) => Task.countDocuments({ $and: [base, personClause(viewer.idStr), stageClause(stages)] });
  const [open, done] = await Promise.all([n(NOT_DONE), n(["done"])]);
  return { open, done, projectIds: projects.map((p) => p._id) };
}

/** Filter-modal pickers: the visible projects and their people (not for My Workspace). */
async function pickerOptions(projects, { people = true } = {}) {
  return {
    projects: [...projects]
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "th"))
      .map((p) => ({ id: idOf(p._id), label: p.name, icon: p.icon })),
    people: people ? await peopleOptions(projects) : [],
  };
}

// ── Calendar (round 57) ──────────────────────────────────────────────────────

/** Most tasks one calendar range returns (a safety cap; `truncated` says so). */
const CALENDAR_MAX = 1000;
/** "HH:mm" of an instant in Bangkok. */
const bkkTime = (value) => new Date(new Date(value).getTime() + 7 * 3600 * 1000).toISOString().slice(11, 16);

/**
 * Point events of a task (real field names):
 *   Production  one per details.shootSessions[] { date "YYYY-MM-DD", startTime "HH:mm" }
 *               → "นัดถ่าย 13:00" on that date (round 57.1; a legacy details.shoot reads
 *               as one session). Photo: none any more (its Start→Due bar stays).
 *   Post  published: the earliest flow.publishLinks[].postedAt → "โพสต์แล้ว 10:30";
 *         before that: the scheduled time = the task's dueAt → "กำหนดโพสต์ 10:30"
 */
function pointsOf(t) {
  if (t.type === "production") return sessionsFromDetails(t.details).map((x) => ({ day: x.date, label: `นัดถ่าย ${x.startTime}` }));
  if (t.type === "post") {
    const posted = (t.flow?.publishLinks ?? []).map((l) => l?.postedAt).filter(Boolean).map((v) => new Date(v)).sort((a, b) => a - b)[0];
    if (posted) return [{ day: bkkDayKey(posted), label: `โพสต์แล้ว ${bkkTime(posted)}` }];
    if (t.dueAt) return [{ day: bkkDayKey(t.dueAt), label: `กำหนดโพสต์ ${bkkTime(t.dueAt)}` }];
  }
  return [];
}

/**
 * The calendar data for a parsed state (f.view === "calendar").
 * @returns {Promise<{ counts, todayKey, anchor, range: { start, end }, tasks: object[], truncated: boolean, projects, people }>}
 */
export async function loadAllTasksCalendar(viewer, f) {
  const { projects, match, todayKey } = await baseMatch(viewer, f);
  const anchor = f.date || todayKey;
  const range = visibleRange(f.cal, anchor);
  const month = f.cal === "month";
  const dueOnly = month && f.dueOnly;
  const rs = bkkDayStart(range.start);
  const re = bkkDayStart(addDays(range.end, 1));

  // Anything that can draw inside [rs, re). Clipping below drops the rest.
  const or = dueOnly
    ? [{ dueAt: { $gte: rs, $lt: re } }]
    : [
        { startAt: { $lt: re }, dueAt: { $gte: rs } }, // Start + Due bar
        { startAt: null, dueAt: { $gte: rs, $lt: re } }, // Due only
        { dueAt: null, startAt: { $gte: rs, $lt: re } }, // Start only
        // Production: ANY session inside the range (legacy single appointment too).
        { type: "production", "details.shootSessions.date": { $gte: range.start, $lte: range.end } },
        { type: "production", "details.shoot.date": { $gte: range.start, $lte: range.end } },
        { type: "post", "flow.publishLinks.postedAt": { $gte: rs, $lt: re } },
        // Overdue segments (Due+1 .. today) reach into the range.
        ...(todayKey >= range.start ? [{ $and: [{ dueAt: { $lt: re } }, { dueAt: { $lt: bkkDayStart(todayKey) } }, stageClause(NOT_DONE)] }] : []),
      ];

  const [counts, docs] = await Promise.all([
    tabCounts(f, match, todayKey),
    Task.find({ $and: [withTab(match, f.tab, todayKey), { $or: or }] })
      .select("title type status project assignee startAt dueAt details.shoot details.shootSessions flow.publishLinks")
      .sort({ dueAt: 1, _id: 1 })
      .limit(CALENDAR_MAX + 1)
      .lean(),
  ]);
  const truncated = docs.length > CALENDAR_MAX;
  if (truncated) docs.length = CALENDAR_MAX;

  const users = await loadUsers(docs.map((d) => d.assignee));
  const projectName = new Map(projects.map((p) => [idOf(p._id), p.name]));
  const selfQuery = allTasksQuery(f, {}, { keepPage: true });

  const tasks = [];
  for (const t of docs) {
    const stage = statusStage(t.type, t.status) ?? STOPPED_STAGE.key;
    const base = { startKey: t.startAt ? bkkDayKey(t.startAt) : null, dueKey: t.dueAt ? bkkDayKey(t.dueAt) : null, stage };
    if (dueOnly) {
      base.startKey = null; // one marker on Due
      if (!base.dueKey) continue;
    }
    const points = dueOnly ? [] : pointsOf(t).filter((p) => p.day >= range.start && p.day <= range.end);
    const visible =
      clipSpan(barSpan(base), range.start, range.end) ||
      (!dueOnly && clipSpan(overdueSpan(base, todayKey), range.start, range.end)) ||
      points.length;
    if (!visible) continue;
    const id = idOf(t._id);
    tasks.push({
      id,
      title: t.title,
      type: t.type,
      typeLabel: getTaskType(t.type)?.label ?? t.type,
      statusLabel: statusInfo(t.type, t.status).label,
      ...base,
      points,
      assignee: t.assignee ? (users.get(idOf(t.assignee)) ?? unknownUser(t.assignee)) : null,
      projectName: projectName.get(idOf(t.project)) ?? "",
      openHref: openHrefOf(f, selfQuery, id),
    });
  }

  return { counts, todayKey, anchor, range: { start: range.start, end: range.end }, tasks, truncated, ...(await pickerOptions(projects, { people: f.scope !== "mine" })) };
}

function groupLabel(group, r, projectById, users) {
  if (group === "project") {
    const p = projectById.get(r.groupKey);
    return { kind: "project", name: p?.name ?? "—", icon: p?.icon ?? null };
  }
  if (group === "type") return { kind: "type", type: r.type, name: r.typeLabel };
  if (group === "assignee") {
    const u = r.groupKey ? (users.get(r.groupKey) ?? unknownUser(r.groupKey)) : null;
    return { kind: "assignee", name: u?.name ?? "ไม่มีผู้รับผิดชอบ", avatarUrl: u?.avatarUrl ?? null, empty: !u };
  }
  const st = TASK_STAGES.find((x) => x.key === r.groupKey) ?? STOPPED_STAGE;
  return { kind: "stage", name: st.label, dot: st.dot };
}

/** ผู้รับผิดชอบ picker: the ACTIVE people of the visible projects (owners + members). */
async function peopleOptions(projects) {
  const ids = [...new Set(projects.flatMap((p) => [p.owner, ...(p.members ?? [])]).map(idOf).filter(Boolean))];
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids }, isActive: true }).select("name avatar.url").lean();
  return users
    .map((u) => ({ id: idOf(u._id), label: u.name, avatarUrl: u.avatar?.url ?? null }))
    .sort((a, b) => a.label.localeCompare(b.label, "th"));
}
