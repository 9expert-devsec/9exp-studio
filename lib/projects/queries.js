// Project read models for the pages (server only). Every loader takes the viewer
// from getProjectViewer() and only returns what that viewer may see. Output is
// plain serializable data for client components.

import "server-only";
import { cache } from "react";
import Content from "@/models/Content";
import Project from "@/models/Project";
import ProjectPin from "@/models/ProjectPin";
import Role from "@/models/Role";
import User from "@/models/User";
import {
  canAddContent,
  canCancel,
  canChangeTaskStatus,
  canDeleteContent,
  canDeleteTask,
  canEdit,
  canEditContent,
  canReopen,
  creatableTaskTypes,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
  visibleProjectsFilter,
} from "./access";
import {
  PROJECT_TYPE_LABEL,
  briefLabel,
  contentNumberLabel,
  formatProjectDate,
  formatUpdatedAt,
  projectDateLabel,
} from "./format";
import Task from "@/models/Task";
import {
  assetStatusLabel,
  getTaskType,
  hasAssetStatus,
  statusInfo as taskStatusInfo,
} from "@/lib/tasks/types";
import {
  contentStats,
  contentTaskCounts,
  contentTaskCountsForProject,
  emptyCounts,
  projectStats,
  projectTaskCounts,
  projectsTaskCounts,
} from "./progress";
import { PROJECT_TYPE, escapeRegex, toDateInput } from "./rules";
import { deriveAutoStatus, deriveContentStatus } from "./status";

const idOf = (v) => (v ? v.toString() : "");

async function loadUsers(ids, { withRoles = false } = {}) {
  const unique = [...new Set(ids.map(idOf).filter(Boolean))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select("name email role avatar.url")
    .lean();

  let roleName = new Map();
  if (withRoles) {
    const keys = [...new Set(users.map((u) => u.role).filter(Boolean))];
    const roles = keys.length ? await Role.find({ key: { $in: keys } }).select("key name").lean() : [];
    roleName = new Map(roles.map((r) => [r.key, r.name]));
  }

  return new Map(
    users.map((u) => [
      u._id.toString(),
      {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        avatarUrl: u.avatar?.url ?? null,
        ...(withRoles ? { roleName: roleName.get(u.role) ?? "" } : {}),
      },
    ])
  );
}

const unknownUser = (id) => ({ id: idOf(id), name: "Unknown account", email: "", avatarUrl: null });

function summarize(project, users, viewer, pinnedSet, counts) {
  const stats = projectStats(counts);
  const status = deriveAutoStatus(project, stats.tasks);
  const owner = users.get(idOf(project.owner)) ?? unknownUser(project.owner);
  const members = (project.members ?? []).map((m) => users.get(idOf(m))).filter(Boolean);
  const id = project._id.toString();
  const withStatus = { ...project, status };

  return {
    id,
    href: `/projects/${id}`,
    name: project.name,
    icon: project.icon,
    // Legacy "ongoing" documents are shown as campaigns.
    type: PROJECT_TYPE,
    typeLabel: PROJECT_TYPE_LABEL,
    status,
    description: project.description ?? "",
    datesLabel: projectDateLabel(project),
    memberCount: 1 + (project.members?.length ?? 0),
    files: stats.files,
    progress: stats.progress,
    owner,
    team: [owner, ...members],
    pinned: pinnedSet.has(id),
    canEdit: canEdit(viewer, withStatus),
    canCancel: canCancel(viewer, withStatus),
    canReopen: canReopen(viewer, withStatus),
  };
}

/**
 * /projects: every visible project (updatedAt desc), the filtered subset, and the
 * featured row (pins first, then most recently updated; filters don't apply).
 */
export async function loadProjectsView(viewer, filters) {
  const [all, pins] = await Promise.all([
    Project.find(visibleProjectsFilter(viewer)).sort({ updatedAt: -1 }).lean(),
    ProjectPin.find({ account: viewer.id }).sort({ createdAt: 1 }).lean(),
  ]);

  const pinnedSet = new Set(pins.map((p) => idOf(p.project)));
  const [users, counts] = await Promise.all([
    loadUsers(all.flatMap((p) => [p.owner, ...(p.members ?? [])])),
    projectsTaskCounts(all.map((p) => p._id)),
  ]);
  const summaries = all.map((p) => summarize(p, users, viewer, pinnedSet, counts.get(idOf(p._id))));
  const byId = new Map(summaries.map((s) => [s.id, s]));

  const projects = summaries.filter((s) => !filters.statuses.length || filters.statuses.includes(s.status));

  // Pins of projects the viewer can no longer see are simply skipped.
  const pinned = pins.map((p) => byId.get(idOf(p.project))).filter(Boolean);
  const featured = [...pinned, ...summaries.filter((s) => !s.pinned)].slice(0, 2);

  return { total: summaries.length, projects, featured };
}

/**
 * The viewer + the raw project for every /projects/[id]/(tabs) route, or null when
 * signed out, missing or not viewable (callers → notFound()). Memoised per request,
 * so the shared layout and the page share one lookup.
 */
export const loadProjectContext = cache(async (id) => {
  const viewer = await getProjectViewer();
  if (!viewer) return null;
  const project = await findViewableProject(viewer, id);
  return project ? { viewer, project } : null;
});

/** Header card + Overview data for a loaded context. */
export const loadProjectDetail = cache(async (id) => {
  const ctx = await loadProjectContext(id);
  if (!ctx) return null;
  const { viewer, project } = ctx;

  const [pin, users, counts] = await Promise.all([
    ProjectPin.exists({ account: viewer.id, project: project._id }),
    loadUsers([project.owner, ...(project.members ?? [])], { withRoles: true }),
    projectTaskCounts(project._id),
  ]);
  const summary = summarize(project, users, viewer, new Set(pin ? [project._id.toString()] : []), counts);
  const stats = projectStats(counts);

  return {
    ...summary,
    briefLink: project.briefLink ?? "",
    startDateLabel: formatProjectDate(project.startDate),
    endDateLabel: formatProjectDate(project.endDate),
    cancelledAtLabel:
      summary.status === "cancelled" && project.cancelledAt ? formatProjectDate(project.cancelledAt) : "",
    tasks: stats.tasks,
  };
});

/** /projects/[id]/edit: null unless the viewer may EDIT (caller → notFound()). */
export async function loadProjectForEdit(viewer, id) {
  const project = await findViewableProject(viewer, id);
  if (!project || !canEdit(viewer, project)) return null;

  const [users, counts] = await Promise.all([
    loadUsers([project.owner, ...(project.members ?? [])]),
    projectTaskCounts(project._id),
  ]);
  return {
    id: project._id.toString(),
    name: project.name,
    icon: project.icon,
    startDate: toDateInput(project.startDate),
    endDate: toDateInput(project.endDate),
    description: project.description ?? "",
    briefLink: project.briefLink ?? "",
    status: deriveAutoStatus(project, counts),
    owner: users.get(idOf(project.owner)) ?? unknownUser(project.owner),
    members: (project.members ?? []).map((m) => users.get(idOf(m))).filter(Boolean),
  };
}

/** The viewer as a form "owner" row (create page). */
export function viewerAsOwner(viewer) {
  return {
    id: viewer.idStr,
    name: viewer.user.name,
    email: "",
    avatarUrl: viewer.user.avatar?.url ?? null,
  };
}

// ---------------------------------------------------------------------------
// Content

/**
 * A task shaped for <TaskCard> / <TasksTable> / the task ⋯ menu. Labels come from
 * the catalog (lib/tasks/types.js); `group` drives the chip colour. Permission flags
 * are UX only; the actions re-check.
 */
function taskView(task, users, ctx) {
  const info = taskStatusInfo(task.type, task.status);
  const type = getTaskType(task.type);
  return {
    id: task._id.toString(),
    projectId: idOf(task.project),
    contentId: idOf(task.content),
    number: task.number,
    numberLabel: contentNumberLabel(task.number),
    title: task.title,
    type: task.type,
    typeLabel: type?.label ?? task.type,
    status: task.status,
    statusLabel: info.label,
    group: info.group,
    assetStatus: hasAssetStatus(task.type) ? (task.assetStatus ?? null) : null,
    assetStatusLabel: hasAssetStatus(task.type) ? assetStatusLabel(task.type, task.assetStatus) : "",
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    createdBy: users.get(idOf(task.createdBy)) ?? unknownUser(task.createdBy),
    assignee: task.assignee ? (users.get(idOf(task.assignee)) ?? unknownUser(task.assignee)) : null,
    canChangeStatus: canChangeTaskStatus(ctx.viewer, ctx.project, task),
    canDelete: canDeleteTask(ctx.viewer, ctx.project, task),
  };
}

const taskPeople = (tasks) => tasks.flatMap((t) => [t.createdBy, t.assignee]).filter(Boolean);

/** Due date asc/desc with no-due-date tasks LAST either way; ties by number asc. */
function sortTasks(tasks, sort) {
  const dir = sort === "due_desc" ? -1 : 1;
  const time = (t) => (t.dueDate ? new Date(t.dueDate).getTime() : null);
  return [...tasks].sort((a, b) => {
    const ta = time(a);
    const tb = time(b);
    if (ta !== tb) {
      if (ta === null) return 1;
      if (tb === null) return -1;
      return (ta - tb) * dir;
    }
    return a.number - b.number;
  });
}

function contentSummary(content, ctx, counts = emptyCounts(), recentTasks = []) {
  const stats = contentStats(counts, recentTasks);
  const id = content._id.toString();
  const projectId = ctx.project._id.toString();
  const projectHref = `/projects/${projectId}`;
  return {
    id,
    projectId,
    projectHref,
    href: `${projectHref}/content/${id}`,
    number: content.number,
    numberLabel: contentNumberLabel(content.number),
    name: content.name,
    status: deriveContentStatus(content, stats),
    briefLink: content.briefLink ?? "",
    stats,
    canEdit: canEditContent(ctx.viewer, ctx.project, content),
    canDelete: canDeleteContent(ctx.viewer, ctx.project, content),
    editHref: `${projectHref}/content/${id}/edit`,
  };
}

/**
 * Content tab: items of ONE project (number asc) matching the URL filters.
 * Search is server-side (regex-escaped, case-insensitive, name or description);
 * status is matched after derivation from the item's task counts. Each card gets
 * its counts (one aggregate for the project) and its 3 most recently updated tasks.
 * @returns {{ total: number, items: object[], canAdd: boolean }}
 */
export async function loadContentList(ctx, filters) {
  const base = { project: ctx.project._id };
  const re = filters.q ? new RegExp(escapeRegex(filters.q), "i") : null;
  const [total, docs, counts] = await Promise.all([
    Content.countDocuments(base),
    Content.find(re ? { ...base, $or: [{ name: re }, { description: re }] } : base)
      .sort({ number: 1 })
      .lean(),
    contentTaskCountsForProject(ctx.project._id),
  ]);

  const matching = docs.filter(
    (c) => !filters.status || deriveContentStatus(c, counts.get(idOf(c._id))) === filters.status
  );
  const recent = await Promise.all(
    matching.map((c) =>
      counts.get(idOf(c._id))?.all
        ? Task.find({ content: c._id, project: ctx.project._id }).sort({ updatedAt: -1 }).limit(3).lean()
        : []
    )
  );
  const users = await loadUsers(taskPeople(recent.flat()));

  const items = matching.map((c, i) =>
    contentSummary(
      c,
      ctx,
      counts.get(idOf(c._id)),
      recent[i].map((t) => taskView(t, users, ctx))
    )
  );

  return { total, items, canAdd: canAddContent(ctx.viewer, ctx.project) };
}

/** Edit Content: null unless the item belongs to the project and the viewer may edit it. */
export async function loadContentForEdit(ctx, contentId) {
  const content = await findProjectContent(ctx.project, contentId);
  if (!content || !canEditContent(ctx.viewer, ctx.project, content)) return null;
  return {
    id: content._id.toString(),
    numberLabel: contentNumberLabel(content.number),
    name: content.name,
    description: content.description ?? "",
    briefLink: content.briefLink ?? "",
    dueDate: toDateInput(content.dueDate),
    canDelete: canDeleteContent(ctx.viewer, ctx.project, content),
  };
}

/**
 * Content detail page: null unless the item belongs to this (viewable) project
 * (caller → notFound()). Counts cover ALL its tasks; `tasks` is the filtered list:
 * title search (server-side, regex-escaped, case-insensitive), status GROUP, and
 * the due-date sort (no due date last; ties by number). `taskTypes` = the types
 * this viewer may create here ([] → no "+ Add task").
 */
export async function loadContentDetail(ctx, contentId, taskFilters) {
  const content = await findProjectContent(ctx.project, contentId);
  if (!content) return null;

  const re = taskFilters.q ? new RegExp(escapeRegex(taskFilters.q), "i") : null;
  const [counts, docs] = await Promise.all([
    contentTaskCounts(ctx.project._id, content._id),
    Task.find({ content: content._id, project: ctx.project._id, ...(re ? { title: re } : {}) }).lean(),
  ]);
  const users = await loadUsers([content.createdBy, ...taskPeople(docs)]);
  const views = docs.map((t) => taskView(t, users, ctx)).filter((t) => !taskFilters.status || t.group === taskFilters.status);

  const summary = contentSummary(content, ctx, counts);
  const tasks = sortTasks(views, taskFilters.sort);
  return {
    ...summary,
    description: content.description ?? "",
    briefLabel: summary.briefLink ? briefLabel(summary.briefLink) : "",
    dueDateLabel: formatProjectDate(content.dueDate),
    updatedAtLabel: formatUpdatedAt(content.updatedAt),
    createdBy: users.get(idOf(content.createdBy)) ?? unknownUser(content.createdBy),
    projectIcon: ctx.project.icon,
    projectName: ctx.project.name,
    taskTypes: creatableTaskTypes(ctx.viewer, ctx.project),
    tasks,
  };
}
