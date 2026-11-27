// Project read models for the pages (server only). Every loader takes the viewer
// from getProjectViewer() and only returns what that viewer may see. Output is
// plain serializable data for client components.

import "server-only";
import { cache } from "react";
import { connection } from "next/server";
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
  canEditTask,
  canReopen,
  canReorderContent,
  canReorderTasks,
  creatableTaskTypes,
  taskReadAccess,
  findContentTask,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
  taskEligibility,
  visibleProjectsFilter,
} from "./access";
import {
  PROJECT_TYPE_LABEL,
  briefLabel,
  contentNumberLabel,
  formatProjectDate,
  formatTaskDateTime,
  formatThaiDateTime,
  formatUpdatedAt,
  projectDateLabel,
  relativeTimeLabel,
  taskIdLabel,
} from "./format";
import Task from "@/models/Task";
import TaskFolder from "@/models/TaskFolder";
import TaskOption from "@/models/TaskOption";
import { detailTypes } from "@/lib/tasks/details";
import { folderSuffixForType } from "@/lib/tasks/folderId";
import { folderOptionLabel, visibleFolders } from "@/lib/tasks/folders";
import { detailsForEdit } from "@/lib/tasks/editValues";
import { extraPeopleCount } from "@/lib/tasks/production";
import { externalPeopleForPicker, loadExternalPeople } from "@/lib/tasks/externalPeople";
import { withMirrorDetails } from "@/lib/msdb";
import { normalizeRelated } from "@/lib/tasks/related";
import { derivedAssetStatuses, loadAssetRows } from "@/lib/tasks/assetRows";
import { TASK_OPTION_LIST_KEYS } from "@/lib/tasks/options";
import {
  assetStatusLabel,
  getTaskType,
  hasAssetStatus,
  statusInfo as taskStatusInfo,
  workLevelLabel,
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
import { hasContentFilters, hasTaskFilters, taskFiltersQuery } from "./filters";
import { buildStatusStepper } from "@/lib/tasks/stepper";
import { allowedNextStatuses, canTransition, taskHasRelatedAssets } from "@/lib/tasks/transitions";
import { canOverrideTaskStatus } from "@/lib/permissions";
import { latestStatusChange, loadActivityPage } from "@/lib/tasks/activity";
import { clipPrimaryAction, defaultRelatedProductionId } from "@/lib/tasks/clipFlow";
import {
  REVIEW_STATUS,
  cycleOutcome,
  isReviewType,
  orderSections,
  pendingForViewer,
  resubmitBase,
  reviewAction,
  reviewMoveOpts,
  reviewSections,
  sectionLabel,
} from "@/lib/tasks/reviews";
import { loadCycles } from "@/lib/tasks/reviewStore";
import { loadWorkPlan } from "@/lib/tasks/workplanStore";
import { buildStatusView, hasStatusView } from "@/lib/tasks/statusView";
import { assetReadiness } from "@/lib/tasks/assets";
import { sortByOrder } from "./order";
import { deriveAutoStatus, deriveContentStatus } from "./status";

const idOf = (v) => (v ? v.toString() : "");

// Exported for lib/tasks/allTasks.js (round 56).
export async function loadUsers(ids, { withRoles = false } = {}) {
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

export const unknownUser = (id) => ({ id: idOf(id), name: "Unknown account", email: "", avatarUrl: null });

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
function taskView(task, users, ctx, assetStatusByPost = new Map()) {
  const info = taskStatusInfo(task.type, task.status);
  const type = getTaskType(task.type);
  // Post: Status Asset DERIVED from its Related Assets (any stored value is ignored).
  const assetKey = hasAssetStatus(task.type) ? (assetStatusByPost.get(task._id.toString()) ?? "not_needed") : null;
  return {
    id: task._id.toString(),
    projectId: idOf(task.project),
    contentId: idOf(task.content),
    number: task.number,
    sortOrder: Number.isFinite(task.sortOrder) ? task.sortOrder : null,
    numberLabel: contentNumberLabel(task.number),
    title: task.title,
    type: task.type,
    typeLabel: type?.label ?? task.type,
    status: task.status,
    statusLabel: info.label,
    group: info.group,
    assetStatus: assetKey,
    assetStatusLabel: assetKey ? assetStatusLabel(task.type, assetKey) : "",
    dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : null,
    dueAtLabel: formatTaskDateTime(task.dueAt),
    workLevelLabel: workLevelLabel(task.details?.workLevel),
    createdBy: users.get(idOf(task.createdBy)) ?? unknownUser(task.createdBy),
    assignee: task.assignee ? (users.get(idOf(task.assignee)) ?? unknownUser(task.assignee)) : null,
    // Production: "+N" next to the assignee = the other videographers + account presenters.
    extraPeople: extraPeopleCount(task),
    canEdit: canEditTask(ctx.viewer, ctx.project, task),
    canChangeStatus: canChangeTaskStatus(ctx.viewer, ctx.project, task),
    // Round 40: the menu's choices (arrows + escape hatches; override for
    // superadmin / owner). UX only — changeTaskStatusAction re-checks canTransition.
    statusMoves: canChangeTaskStatus(ctx.viewer, ctx.project, task)
      ? allowedNextStatuses(task.type, task.status, {
          canOverride: canOverrideTaskStatus(ctx.viewer, ctx.project),
          hasRelatedAssets: taskHasRelatedAssets(task),
          statusBeforeHold: task.statusBeforeHold ?? null,
          ...reviewMoveOpts(task.type), // round 46
        })
      : [],
    // Round 46: a move into รอตรวจ opens the Submit dialog instead (StatusMoveForm).
    reviewable: isReviewType(task.type),
    canDelete: canDeleteTask(ctx.viewer, ctx.project, task),
  };
}

const taskPeople = (tasks) => tasks.flatMap((t) => [t.createdBy, t.assignee]).filter(Boolean);

/** Panel rows for Production people: accounts by id + saved externals (with the badge flag). */
async function productionPeopleRows(d) {
  const videographers = (d.videographers ?? []).map(idOf);
  const presenters = (d.presenters ?? []).filter((p) => p?.id);
  const userIds = [...videographers, ...presenters.filter((p) => p.kind === "user").map((p) => idOf(p.id))];
  const [users, externals] = await Promise.all([
    loadUsers(userIds),
    loadExternalPeople(presenters.filter((p) => p.kind === "external").map((p) => p.id)),
  ]);
  const account = (id) => users.get(id) ?? unknownUser(id);
  return {
    videographers: videographers.map(account),
    presenters: presenters.map((p) =>
      p.kind === "external"
        ? { id: idOf(p.id), name: externals.get(idOf(p.id))?.name ?? "Unknown", external: true }
        : account(idOf(p.id))
    ),
  };
}

/**
 * "manual" (default): the drag order (sortOrder, else number — lib/projects/order.js).
 * Due date asc/desc: no-due-date tasks LAST either way; ties by number asc.
 */
function sortTasks(tasks, sort) {
  if (sort !== "due_asc" && sort !== "due_desc") return sortByOrder(tasks);
  const dir = sort === "due_desc" ? -1 : 1;
  const time = (t) => (t.dueAt ? new Date(t.dueAt).getTime() : null);
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
 * Content tab: items of ONE project in manual order (sortOrder, else number —
 * lib/projects/order.js) matching the URL filters. Search is server-side
 * (regex-escaped, case-insensitive, name or description); status is matched after
 * derivation from the item's task counts. Each card gets its counts (one
 * aggregate for the project), its FIRST 3 tasks in manual order, and the full
 * task order (`taskOrder`, so a drag among the 3 saves the whole list).
 * `canReorder` (content cards) is false while a filter is active.
 * @returns {{ total: number, items: object[], canAdd: boolean, canReorder: boolean }}
 */
export async function loadContentList(ctx, filters) {
  const base = { project: ctx.project._id };
  const re = filters.q ? new RegExp(escapeRegex(filters.q), "i") : null;
  const [total, docs, counts, allTasks, creatable] = await Promise.all([
    Content.countDocuments(base),
    Content.find(re ? { ...base, $or: [{ name: re }, { description: re }] } : base).lean(),
    contentTaskCountsForProject(ctx.project._id),
    Task.find(base).lean(),
    creatableTaskTypes(ctx.viewer, ctx.project),
  ]);

  const matching = sortByOrder(docs).filter(
    (c) => !filters.status || deriveContentStatus(c, counts.get(idOf(c._id))) === filters.status
  );
  const byContent = new Map();
  for (const t of allTasks) {
    const k = idOf(t.content);
    if (!byContent.has(k)) byContent.set(k, []);
    byContent.get(k).push(t);
  }
  const ordered = matching.map((c) => sortByOrder(byContent.get(idOf(c._id)) ?? []));
  const shown = ordered.flatMap((list) => list.slice(0, 3));
  const [users, assetStatusByPost] = await Promise.all([loadUsers(taskPeople(shown)), derivedAssetStatuses(shown)]);
  const canAdd = canAddContent(ctx.viewer, ctx.project);

  const items = matching.map((c, i) => {
    const tasks = ordered[i];
    const types = [...new Set(tasks.map((t) => t.type))];
    return {
      ...contentSummary(
        c,
        ctx,
        counts.get(idOf(c._id)),
        tasks.slice(0, 3).map((t) => taskView(t, users, ctx, assetStatusByPost))
      ),
      taskOrder: tasks.map((t) => t._id.toString()),
      taskCount: tasks.length,
      canReorderTasks: canReorderTasks(ctx.viewer, ctx.project, c),
      // Duplicate = add content + create every task type it holds (the action re-checks).
      canDuplicate: canAdd && types.every((t) => creatable.includes(t)),
    };
  });

  return {
    total,
    items,
    canAdd,
    canReorder: canReorderContent(ctx.viewer, ctx.project),
    reorderBlocked: hasContentFilters(filters),
  };
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
  const [users, assetStatusByPost] = await Promise.all([
    loadUsers([content.createdBy, ...taskPeople(docs)]),
    derivedAssetStatuses(docs),
  ]);
  const views = docs
    .map((t) => taskView(t, users, ctx, assetStatusByPost))
    .filter((t) => !taskFilters.status || t.group === taskFilters.status);

  const summary = contentSummary(content, ctx, counts);
  const taskTypes = await creatableTaskTypes(ctx.viewer, ctx.project);
  // Duplicate (task ⋯) = may create that type here; the action re-checks.
  const tasks = sortTasks(views, taskFilters.sort).map((t) => ({ ...t, canDuplicate: taskTypes.includes(t.type) }));
  return {
    ...summary,
    // Drag order: allowed for the content's editors; blocked (with a hint) while a
    // search/status filter or a due-date sort shows a partial or different order.
    canReorderTasks: canReorderTasks(ctx.viewer, ctx.project, content),
    reorderBlocked: hasTaskFilters(taskFilters) ? "filters" : taskFilters.sort !== "manual" ? "sort" : null,
    description: content.description ?? "",
    briefLabel: summary.briefLink ? briefLabel(summary.briefLink) : "",
    dueDateLabel: formatProjectDate(content.dueDate),
    updatedAtLabel: formatUpdatedAt(content.updatedAt),
    createdBy: users.get(idOf(content.createdBy)) ?? unknownUser(content.createdBy),
    projectIcon: ctx.project.icon,
    projectName: ctx.project.name,
    taskTypes,
    tasks,
    drawer: await loadTaskDrawer(ctx, content, taskFilters),
  };
}

const personOption = (u) => ({ id: u._id.toString(), name: u.name, email: u.email, avatarUrl: u.avatar?.url ?? null });
// Work types per platform: lib/tasks/optionQueries.js (re-exported for callers here).
export { getWorkTypesForPlatforms } from "@/lib/tasks/optionQueries";

const PERSON_FIELDS = ["assignee", "contentReviewer", "videoReviewer", "designReviewer", "editor"];
const optionView = (o) => ({
  id: o._id.toString(),
  label: o.label,
  icon: o.icon ?? null,
  active: !!o.active,
  // Work types: linked platform ids (the Graphic form filters by platform).
  ...(o.list === "work_type" ? { platforms: (o.platforms ?? []).map(String) } : {}),
});

/**
 * Create / Edit Task drawer data, only while it is open (?newTask=1 or
 * ?editTask=<id> for a task this viewer may edit), else null.
 *   detailTypes  types with a Step 2 (lib/tasks/details.js)
 *   options      active TaskOptions per list (+ inactive ones the edited task uses)
 *   people       eligible assignee / reviewers per detail type (lib/projects/access.js
 *                taskEligibility — the same rule the save enforces)
 */
async function loadTaskDrawer(ctx, content, filters) {
  let editing = null;
  if (filters.editTask && !filters.newTask) {
    const task = await findContentTask(ctx.project, content, filters.editTask);
    if (!task || !canEditTask(ctx.viewer, ctx.project, task)) return null;
    // Related: one item from either stored shape; snapshots saved before
    // iconUrl / isInhouse existed are filled from the mirror.
    const rel = normalizeRelated(task.details);
    rel.related = await withMirrorDetails(rel.related);
    editing = {
      id: task._id.toString(),
      numberLabel: contentNumberLabel(task.number),
      title: task.title,
      type: task.type,
      details: detailsForEdit(task, rel),
    };
    // Post / Article: Related Assets as live rows (title, status…), for the selected list.
    if (Array.isArray(editing.details.relatedAssets)) {
      editing.details.relatedAssets = await loadAssetRows(editing.details.relatedAssets);
    }
    // Graphic / Photo: the folder-level texts come from the task's folder (a
    // Graphic whose folder has no location yet shows its own legacy value).
    if (editing.details.folder?.folderId) {
      const f = await TaskFolder.findOne({ folderId: editing.details.folder.folderId }).select("name location").lean();
      if (task.type === "graphic") editing.details.fileLocation = f?.location || editing.details.fileLocation;
      else {
        editing.details.folderName = f?.name || editing.details.folderName;
        editing.details.folderLocation = f?.location || editing.details.folderLocation;
      }
    }
  }
  if (!filters.newTask && !editing) return null;

  // Inactive options this task already uses stay listed (so they render and can be kept).
  const ed = editing?.details;
  const used = ed ? [ed.videoType, ...(ed.platforms ?? []), ed.platform, ed.workType, ed.articleType, ed.photoType].filter(Boolean) : [];
  const types = detailTypes();
  // Choose Folder lists: this project's folders per folder type (only the edited
  // task's type in edit mode).
  const folderTypes = types.filter((t) => folderSuffixForType(t) && (!editing || editing.type === t));
  const [options, eligibility, roles, folderLists] = await Promise.all([
    TaskOption.find({ list: { $in: TASK_OPTION_LIST_KEYS }, $or: [{ active: true }, { _id: { $in: used } }] })
      .sort({ order: 1, label: 1 })
      .lean(),
    Promise.all(types.map((t) => taskEligibility(ctx.project, t))),
    Role.find().select("key name").lean(),
    Promise.all(folderTypes.map((t) => loadProjectFolders(ctx.project._id, folderSuffixForType(t)))),
  ]);
  const folders = Object.fromEntries(folderTypes.map((t, i) => [t, folderLists[i]]));
  const byList = Object.fromEntries(TASK_OPTION_LIST_KEYS.map((k) => [k, []]));
  for (const o of options) byList[o.list]?.push(optionView(o));

  // Person rows carry the role name (shown muted in the single-person picker).
  const roleName = new Map(roles.map((r) => [r.key, r.name]));
  const personWithRole = (u) => ({ ...personOption(u), roleLabel: roleName.get(u.role) ?? null });

  // people[type] = { assignee, contentReviewer, videoReviewer, designReviewer } candidate lists.
  const people = Object.fromEntries(
    types.map((t, i) => {
      const e = eligibility[i];
      const inSet = (set) => e.people.filter((u) => set.has(u._id.toString())).map(personWithRole);
      return [
        t,
        {
          assignee: inSet(e.assignee),
          contentReviewer: inSet(e.contentReviewer),
          videoReviewer: inSet(e.videoReviewer),
          designReviewer: inSet(e.designReviewer),
          editor: inSet(e.editor),
        },
      ];
    })
  );

  // Editing: a stored assignee/reviewer who is no longer eligible stays visible
  // (flagged `ineligible`) so the form shows them with a warning; the save
  // accepts that unchanged value (lib/tasks/details.js).
  const lists = editing && people[editing.type];
  if (lists) {
    const missing = PERSON_FIELDS.filter((f) => editing.details[f] && !lists[f].some((p) => p.id === editing.details[f]));
    if (missing.length) {
      const ids = [...new Set(missing.map((f) => editing.details[f]))];
      const found = await User.find({ _id: { $in: ids } }).select("name email role avatar").lean();
      const byId = new Map(found.map((u) => [u._id.toString(), personWithRole(u)]));
      for (const f of missing) {
        const id = editing.details[f];
        lists[f] = [...lists[f], { ...(byId.get(id) ?? { id, name: "Unknown user", email: null, avatarUrl: null, roleLabel: null }), ineligible: true }];
      }
    }
  }

  // Production (round 38): Videographer = people whose role may do Production
  // (the assignee set); Presenter = ANY active account + saved external people.
  let externals = [];
  if (types.includes("production") && (!editing || editing.type === "production")) {
    const p = people.production;
    p.videographer = p.assignee;
    const accounts = await User.find({ isActive: true }).select("name email role avatar").sort({ name: 1 }).limit(1000).lean();
    p.presenter = accounts.map(personWithRole);
    const storedExternalIds = editing ? editing.details.presenters.filter((x) => x.kind === "external").map((x) => x.id) : [];
    externals = await externalPeopleForPicker(storedExternalIds);
    if (editing) {
      // A stored pick who no longer qualifies stays visible, flagged (same rule as PersonPicker).
      const missingV = editing.details.videographers.map((x) => x.id).filter((id) => !p.videographer.some((u) => u.id === id));
      const missingP = editing.details.presenters
        .filter((x) => x.kind === "user" && !p.presenter.some((u) => u.id === x.id))
        .map((x) => x.id);
      const ids = [...new Set([...missingV, ...missingP])];
      if (ids.length) {
        const found = await User.find({ _id: { $in: ids } }).select("name email role avatar").lean();
        const row = (id) => ({
          ...(found.find((u) => u._id.toString() === id) ? personWithRole(found.find((u) => u._id.toString() === id)) : { id, name: "Unknown user", email: null, avatarUrl: null, roleLabel: null }),
          ineligible: true,
        });
        p.videographer = [...p.videographer, ...missingV.map(row)];
        p.presenter = [...p.presenter, ...missingP.map(row)];
      }
    }
  }

  // Clip "Related Production" (round 45): this project's Production tasks. A
  // cancelled one is offered only when the edited clip already links it; a link
  // to a deleted task is cleared from the form.
  let productions = [];
  let defaultRelatedProduction = "";
  if (types.includes("clip") && (!editing || editing.type === "clip")) {
    const stored = editing?.details.relatedProduction ?? "";
    const all = await loadProjectProductions(ctx.project._id);
    productions = all.filter((p) => p.group !== "cancelled" || p.id === stored);
    if (editing && stored && !all.some((p) => p.id === stored)) editing.details.relatedProduction = "";
    if (!editing) defaultRelatedProduction = defaultRelatedProductionId(all, idOf(content._id));
  }

  return {
    mode: editing ? "edit" : "create",
    editing,
    detailTypes: types,
    options: byList,
    people,
    folders,
    externals,
    productions,
    defaultRelatedProduction,
  };
}

const PRODUCTION_LIST_MAX = 300;

/**
 * Related Production picker rows: this project's Production tasks, newest first:
 * { id, title, numberLabel, contentId, contentName, status, statusLabel, group, dueLabel }.
 */
async function loadProjectProductions(projectId) {
  const tasks = await Task.find({ project: projectId, type: "production" })
    .sort({ createdAt: -1 })
    .limit(PRODUCTION_LIST_MAX)
    .select("title number content status dueAt")
    .lean();
  if (!tasks.length) return [];
  const contents = await Content.find({ _id: { $in: [...new Set(tasks.map((t) => idOf(t.content)))] }, project: projectId })
    .select("name")
    .lean();
  const contentName = new Map(contents.map((c) => [idOf(c._id), c.name]));
  return tasks.map((t) => {
    const info = taskStatusInfo("production", t.status);
    return {
      id: idOf(t._id),
      title: t.title,
      numberLabel: contentNumberLabel(t.number),
      contentId: idOf(t.content),
      contentName: contentName.get(idOf(t.content)) ?? "",
      status: t.status,
      statusLabel: info.label,
      group: info.group,
      dueLabel: formatTaskDateTime(t.dueAt),
    };
  });
}

/**
 * Task Detail → a Clip's Related Production card (live; null when none / deleted):
 * { id, title, statusLabel, group, dueLabel, videographer: person | null, extraVideographers }.
 */
async function relatedProductionRow(clip) {
  const pid = clip.details?.relatedProductionId;
  if (!pid) return null;
  const t = await Task.findOne({ _id: pid, project: clip.project, type: "production" })
    .select("title status dueAt details.videographers")
    .lean();
  if (!t) return null;
  const vids = (t.details?.videographers ?? []).map(idOf);
  const users = await loadUsers(vids.slice(0, 1));
  const info = taskStatusInfo("production", t.status);
  return {
    id: idOf(t._id),
    title: t.title,
    statusLabel: info.label,
    group: info.group,
    dueLabel: formatTaskDateTime(t.dueAt) || null,
    videographer: vids[0] ? (users.get(vids[0]) ?? unknownUser(vids[0])) : null,
    extraVideographers: Math.max(vids.length - 1, 0),
  };
}

const FOLDER_LIST_MAX = 300;

/**
 * Choose Folder list: this project's folders with one suffix, newest first,
 * only those that hold at least one task (visibleFolders: a wasted number stays
 * wasted and is never offered). Rows: { id, folderId, label ("<id> · <name or
 * newest task title>"), name, location, taskCount }.
 */
async function loadProjectFolders(projectId, suffix) {
  const folders = await TaskFolder.find({ project: projectId, suffix }).sort({ createdAt: -1 }).limit(FOLDER_LIST_MAX).lean();
  if (!folders.length) return [];
  const stats = await Task.aggregate([
    { $match: { project: projectId, folderId: { $in: folders.map((f) => f.folderId) } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$folderId", count: { $sum: 1 }, newestTitle: { $first: "$title" } } },
  ]);
  const byId = new Map(stats.map((s) => [s._id, s]));
  return visibleFolders(
    folders.map((f) => {
      const s = byId.get(f.folderId);
      return {
        id: f.folderId,
        folderId: f.folderId,
        label: folderOptionLabel(f, s?.newestTitle ?? ""),
        name: f.name ?? "",
        location: f.location ?? "",
        taskCount: s?.count ?? 0,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// Task Detail panel (?task=<id>)

/** Sanitised brief HTML → plain text (paragraphs / list items on their own lines). */
function richTextToPlain(html) {
  return String(html ?? "")
    .replace(/<\/(p|li)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Task Detail panel data, or null ("Task not found"). Access (access.js
 * taskReadAccess): "full" when the viewer can see the task's project; "read_only"
 * when they can't but a Post/Article in a project they CAN see links it as a
 * Related Asset — then no menu / Edit / status change, and Project + Content are
 * plain text (`readOnly: true`). The permission flags come from taskView, which
 * re-derives them from the real project (all false for a non-member).
 * Loaded on the client through task-actions.js loadTaskPanelAction (round 35);
 * the client builds the hrefs that open a Related Asset's panel.
 * @param {object} viewer from getProjectViewer()
 * @param {string} taskId
 */
export async function loadTaskPanel(viewer, taskId) {
  if (!viewer || !/^[a-f0-9]{24}$/i.test(taskId ?? "")) return null;
  const task = await Task.findById(taskId).lean();
  if (!task) return null;
  const access = await taskReadAccess(viewer, task);
  if (access.mode === "none") return null;
  const readOnly = access.mode === "read_only";
  const project = access.project;
  const content = await Content.findOne({ _id: task.content, project: project._id }).lean();
  if (!content) return null;
  const ctx = { viewer, project };
  const d = task.details ?? {};
  const type = getTaskType(task.type);

  const optionIds = [d.platform, d.workType, d.videoType, d.articleType, d.photoType, ...(d.platforms ?? [])].filter(Boolean);
  const reviewerFields = [
    ["contentReviewer", "Content Review"],
    ["videoReviewer", "Video Review"],
    ["designReviewer", "Design Review"],
    ["editor", "Editor"], // Photo (round 36)
  ].filter(([k]) => k in d);
  const isPhoto = task.type === "photo";
  const [users, options, assetStatusByPost, creatable, related, folder] = await Promise.all([
    loadUsers([task.createdBy, task.updatedBy, task.assignee, ...reviewerFields.map(([k]) => d[k])]),
    optionIds.length ? TaskOption.find({ _id: { $in: optionIds } }).select("label icon").lean() : [],
    derivedAssetStatuses([task]),
    readOnly ? [] : creatableTaskTypes(viewer, project),
    withMirrorDetails(normalizeRelated(d).related),
    // Shared folder (round 36): name/location are folder-level.
    task.folderId ? TaskFolder.findOne({ folderId: task.folderId }).select("name location").lean() : null,
  ]);
  const opt = new Map(options.map((o) => [idOf(o._id), o]));
  const label = (id) => (id ? (opt.get(idOf(id))?.label ?? "—") : null);
  const person = (id) => (id ? (users.get(idOf(id)) ?? unknownUser(id)) : null);

  const projectHref = `/projects/${idOf(project._id)}`;
  const contentHref = `${projectHref}/content/${idOf(content._id)}`;
  const view = taskView(task, users, ctx, assetStatusByPost);
  const canDuplicate = creatable.includes(task.type);

  const hasAssets = Array.isArray(d.relatedAssets) || task.type === "post" || task.type === "article";
  const assetRows = hasAssets ? await loadAssetRows(d.relatedAssets ?? []) : null;
  const activity = await loadActivityPage(task);
  const production = task.type === "production" ? await productionPeopleRows(d) : null;
  const isClip = task.type === "clip";
  const withView = hasStatusView(task.type); // round 48: Production / Graphic / Photo
  const [relatedProduction, lastMove] = await Promise.all([
    isClip ? relatedProductionRow(task) : null,
    isClip || withView ? latestStatusChange(task) : null,
  ]);
  const fileLocation = isPhoto ? null : folder?.location || d.fileLocation || null;
  const review = isReviewType(task.type) ? await reviewPanelData(task, { viewer, project, view, readOnly }) : null;
  // Work Plan (round 47): every task type.
  const workPlan = await loadWorkPlan(task, { viewer, readOnly, projectOpen: project.status !== "cancelled" });

  const briefHtml = d.brief ?? d.editingRequirements ?? "";
  return {
    id: idOf(task._id),
    type: task.type,
    typeLabel: type?.label ?? task.type,
    idChip: taskIdLabel(task),
    title: task.title,
    description: task.description?.trim() || richTextToPlain(briefHtml),
    readOnly,
    // Read-only viewers can't open those pages → plain text (href null).
    project: { name: project.name, href: readOnly ? null : projectHref },
    content: { name: content.name, href: readOnly ? null : contentHref },
    platform: d.platform ? { label: label(d.platform), icon: opt.get(idOf(d.platform))?.icon ?? null } : null,
    platforms: (d.platforms ?? []).map((id) => ({ label: label(id), icon: opt.get(idOf(id))?.icon ?? null })),
    workType: d.workType ? { title: task.type === "post" ? "Post Type" : "Work Type", label: label(d.workType) } : null,
    items: Number.isInteger(d.items) ? d.items : null,
    videoType: label(d.videoType),
    articleType: label(d.articleType),
    photoType: label(d.photoType),
    related: related ? { kind: related.kind, ...related.snapshot } : null,
    relatedAssets: assetRows,
    assignee: {
      title: task.type === "article" ? "Writer" : isPhoto ? "Camera Man" : "Assignee",
      person: person(task.assignee),
    },
    reviewers: reviewerFields.map(([k, title]) => ({ title, person: person(d[k]) })),
    workLevelLabel: workLevelLabel(d.workLevel) || null,
    start: { title: isPhoto ? "Shoot Date" : "Start Date", label: formatTaskDateTime(task.startAt) || null },
    due: {
      title: task.type === "post" ? "Schedule Post" : isPhoto ? "Output Date" : "Due Date",
      label: formatTaskDateTime(task.dueAt) || null,
    },
    folderId: task.folderId ?? null,
    // Photo: the folder's name + location; Graphic: the folder's location (its
    // own legacy value when the folder has none); Clip: its own File Location.
    folderName: isPhoto ? folder?.name || d.folderName || null : null,
    folderLocation: isPhoto ? folder?.location || d.folderLocation || null : null,
    fileLocation,
    // Production (round 38): people + links.
    videographers: production?.videographers ?? null,
    presenters: production?.presenters ?? null,
    scriptUrl: d.scriptUrl || null,
    recordUrl: d.recordUrl || null,
    created: { atLabel: formatTaskDateTime(task.createdAt), by: person(task.createdBy)?.name ?? null },
    updated: { atLabel: formatTaskDateTime(task.updatedAt), by: task.updatedBy ? (person(task.updatedBy)?.name ?? null) : null },
    updatedRelative: relativeTimeLabel(task.updatedAt),
    // Status & Progress
    status: task.status,
    statusLabel: view.statusLabel,
    group: view.group,
    stepper: buildStatusStepper(task.type, task.status),
    assetStatus: view.assetStatus,
    assetStatusLabel: view.assetStatusLabel,
    canChangeStatus: !readOnly && view.canChangeStatus,
    // ⋯ menu (Change status / Duplicate / Delete — Edit is the header button). None when read-only.
    menuTask: readOnly ? null : { ...view, canEdit: false, editHref: undefined, canDuplicate },
    editHref:
      !readOnly && view.canEdit ? `${contentHref}${taskFiltersQuery({ task: idOf(task._id), editTask: idOf(task._id) })}` : null,
    projectId: idOf(project._id),
    contentId: idOf(content._id),
    activity,
    // Clip (round 45): the redesigned columns read these; other types get null.
    clip: isClip
      ? {
          relatedProduction: relatedProduction ? { ...relatedProduction, canOpen: !readOnly } : null,
          // "เชื่อม" → Edit at the Related Production field (only for editors).
          linkProductionHref:
            !readOnly && view.canEdit
              ? `${contentHref}${taskFiltersQuery({ task: idOf(task._id), editTask: idOf(task._id) })}&focus=relatedProduction`
              : null,
          statusContext: lastMove
            ? {
                atLabel: formatTaskDateTime(lastMove.at),
                by: lastMove.auto ? null : lastMove.actorName,
                autoFrom: lastMove.auto?.productionTitle ?? null,
              }
            : { atLabel: formatTaskDateTime(task.createdAt), by: person(task.createdBy)?.name ?? null, autoFrom: null },
          // Round 46: รอตรวจ / แก้ไข (after a failed cycle) take the review action.
          primaryAction: readOnly
            ? null
            : (review?.action ??
              clipPrimaryAction(task.status, {
                canChangeStatus: view.canChangeStatus,
                canOverride: canOverrideTaskStatus(viewer, project),
                statusBeforeHold: task.statusBeforeHold ?? null,
                fileLocation: fileLocation ?? "",
              })),
        }
      : null,
    // Review cycles (round 46; clip + graphic), else null.
    review,
    workPlan,
    // Status & Progress for Production / Graphic / Photo (round 48), else null.
    statusView: withView ? await statusViewFor(task, { viewer, view, readOnly, review, lastMove, fileLocation, folder, person, project, assetRows, opt }) : null,
    shoot: d.shoot ?? null,
  };
}

/**
 * Round 48: the Status & Progress view of a Production / Graphic / Photo task
 * (lib/tasks/statusView.js), from the panel's facts. File Location: Production
 * details.fileLocation · Graphic the panel's (folder → legacy) · Photo the folder
 * location (→ details.folderLocation). Linked Clips counted for Production.
 */
async function statusViewFor(task, { viewer, view, readOnly, review, lastMove, fileLocation, folder, person, project, assetRows, opt }) {
  const d = task.details ?? {};
  const location =
    task.type === "production" ? d.fileLocation || "" : task.type === "photo" ? folder?.location || d.folderLocation || "" : fileLocation || "";
  const linkedClips =
    task.type === "production" && task.status === "done"
      ? await Task.countDocuments({ project: project._id, type: "clip", "details.relatedProductionId": task._id })
      : 0;
  const bits = review?.statusBits ?? {};
  // Round 49 (Article / Post): flow dates as ISO strings; the post's platform(s).
  const iso = (v) => (v ? new Date(v).toISOString() : null);
  const f = task.flow ?? {};
  const flow = {
    ...f,
    ...(f.publishedAt ? { publishedAt: iso(f.publishedAt) } : {}),
    ...(Array.isArray(f.publishLinks)
      ? { publishLinks: f.publishLinks.map((l) => ({ platformId: String(l.platformId), url: l.url, postedAt: iso(l.postedAt) })) }
      : {}),
  };
  const platforms = task.type === "post" && d.platform
    ? [{ id: String(d.platform), label: opt.get(String(d.platform))?.label ?? "—", icon: opt.get(String(d.platform))?.icon ?? null }]
    : [];
  return buildStatusView({
    type: task.type,
    status: task.status,
    statusBeforeHold: task.statusBeforeHold ?? null,
    createdAt: task.createdAt,
    enteredAt: lastMove?.at ?? task.createdAt,
    flow,
    shoot: d.shoot ?? null,
    // Round 49: THE readiness (lib/tasks/assets.js) of the live asset rows; due date; post platforms.
    assets: assetRows ? assetReadiness(assetRows) : undefined,
    dueAt: task.dueAt ?? null,
    platforms,
    fileLocation: location,
    assigneeName: person(task.assignee)?.name ?? null,
    // Production "ข้อมูลครบ": at least one Videographer and one Presenter.
    complete: (d.videographers ?? []).length > 0 && (d.presenters ?? []).length > 0,
    linkedClips,
    canChangeStatus: !readOnly && view.canChangeStatus,
    canOverride: !readOnly && canOverrideTaskStatus(viewer, project),
    review: {
      openSubmittedAt: bits.openSubmittedAt ?? null,
      closedAt: bits.closedAt ?? null,
      currentStatus: bits.currentStatus ?? null,
      mine: review?.mine ?? [],
      canSubmit: !!review?.canSubmit,
      hasBase: !!bits.hasBase,
    },
  });
}

/**
 * Task Detail → review data (round 46): the cycles shaped for the Reviews tab and
 * the status card. `current` = the latest cycle unless it was withdrawn (then
 * every cycle is history). `mine` = sections this viewer may decide now (own
 * first; full access: every pending one, on behalf). `action` = reviewAction()
 * (null when read-only).
 */
async function reviewPanelData(task, { viewer, project, view, readOnly }) {
  const cycles = await loadCycles(task._id);
  const userIds = cycles.flatMap((c) => [c.submittedBy, ...c.sections.flatMap((s) => [s.reviewerId, s.decidedBy])]);
  const users = await loadUsers(userIds, { withRoles: true });
  const person = (id) => (id ? (users.get(idOf(id)) ?? unknownUser(id)) : null);
  const fullAccess = !!viewer.isAdmin;
  const latest = cycles[0] ?? null;
  const open = latest?.status === "open" ? latest : null;
  const mine = readOnly ? [] : pendingForViewer(open, { viewerId: viewer.idStr, fullAccess });

  const cycleView = (c) => {
    const o = cycleOutcome(c);
    const own = c === open ? mine : [];
    return {
      id: idOf(c._id),
      cycleNo: c.cycleNo,
      link: c.link,
      note: c.note || "",
      resubmit: !!c.resubmit,
      linkUpdated: !!c.linkUpdated,
      status: c.status,
      submittedAtLabel: formatThaiDateTime(c.submittedAt),
      closedAtLabel: formatThaiDateTime(c.closedAt),
      submittedBy: person(c.submittedBy),
      total: o.total,
      passed: o.passed,
      failed: o.failed,
      sections: orderSections(c.sections, own).map((s) => ({
        key: s.key,
        label: sectionLabel(task.type, s.key),
        reviewer: person(s.reviewerId),
        verdict: s.verdict,
        feedback: s.feedback || "",
        decidedAtLabel: formatThaiDateTime(s.decidedAt),
        decidedByName: s.onBehalf ? (person(s.decidedBy)?.name ?? null) : null,
        onBehalf: !!s.onBehalf,
        carriedOver: !!s.carriedOver,
        assignedAtLabel: formatThaiDateTime(s.assignedAt),
        // This viewer may decide it now: "own" (their section) or "behalf" (full access).
        decide: own.includes(s.key) ? (idOf(s.reviewerId) === viewer.idStr ? "own" : "behalf") : null,
      })),
    };
  };
  const current = latest && latest.status !== "withdrawn" ? cycleView(latest) : null;
  const history = cycles.filter((c) => !current || idOf(c._id) !== current.id).map(cycleView);

  const canSubmit =
    !readOnly &&
    view.canChangeStatus &&
    canTransition(task.type, task.status, REVIEW_STATUS.review, {
      canOverride: canOverrideTaskStatus(viewer, project),
      hasRelatedAssets: taskHasRelatedAssets(task),
      statusBeforeHold: task.statusBeforeHold ?? null,
    }).ok;
  return {
    sections: reviewSections(task.type).map((s) => ({ key: s.key, label: s.label })),
    current,
    history,
    mine,
    canSubmit,
    // Raw facts for lib/tasks/statusView.js (round 48).
    statusBits: {
      openSubmittedAt: open?.submittedAt ?? null,
      closedAt: latest && latest.status !== "withdrawn" ? (latest.closedAt ?? null) : null,
      currentStatus: latest && latest.status !== "withdrawn" ? latest.status : null,
      hasBase: !!resubmitBase(cycles),
    },
    action: readOnly
      ? null
      : reviewAction(task.type, { status: task.status, open, base: resubmitBase(cycles), canSubmit, viewerId: viewer.idStr, fullAccess }),
  };
}

// ---------------------------------------------------------------------------
// Timeline tab (round 42)

const TIMELINE_TASK_FIELDS =
  "content number sortOrder title type status assignee startAt dueAt details.platform details.platforms details.videographers details.presenters";

/**
 * Timeline tab: the project's contents (manual display order) with their tasks
 * (manual order), shaped for lib/timeline/layout.js + the chart. One read of each
 * collection; no details beyond what the bars need. Access = the Content tab's
 * (the caller got `ctx` from loadProjectContext). `nowMs` is the request time
 * (overdue / today), taken after connection() so it is per request.
 * `orphanTasks` = tasks whose content is missing (should be 0; not rendered).
 */
export async function loadTimeline(ctx, projectHref) {
  await connection();
  const nowMs = Date.now();
  const base = { project: ctx.project._id };
  const [contents, tasks] = await Promise.all([
    Content.find(base).select("name number sortOrder").lean(),
    Task.find(base).select(TIMELINE_TASK_FIELDS).lean(),
  ]);

  const platformIds = tasks
    .filter((t) => t.type === "post")
    .flatMap((t) => (Array.isArray(t.details?.platforms) && t.details.platforms.length ? t.details.platforms : [t.details?.platform]))
    .filter(Boolean);
  const [users, team, platformDocs] = await Promise.all([
    loadUsers(tasks.map((t) => t.assignee).filter(Boolean)),
    loadUsers([ctx.project.owner, ...(ctx.project.members ?? [])]),
    platformIds.length ? TaskOption.find({ _id: { $in: platformIds } }).select("label icon").lean() : [],
  ]);
  const platform = new Map(platformDocs.map((o) => [idOf(o._id), { label: o.label, icon: o.icon ?? null }]));

  const view = (t) => {
    const info = taskStatusInfo(t.type, t.status);
    const d = t.details ?? {};
    const ids = Array.isArray(d.platforms) && d.platforms.length ? d.platforms : d.platform ? [d.platform] : [];
    const id = idOf(t._id);
    return {
      id,
      number: t.number,
      numberLabel: contentNumberLabel(t.number),
      title: t.title,
      type: t.type,
      typeLabel: getTaskType(t.type)?.label ?? t.type,
      statusLabel: info.label,
      group: info.group,
      startAt: t.startAt ? new Date(t.startAt).toISOString() : null,
      dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : null,
      assignee: t.assignee ? (users.get(idOf(t.assignee)) ?? unknownUser(t.assignee)) : null,
      extraPeople: extraPeopleCount(t),
      platforms: t.type === "post" ? ids.map((p) => platform.get(idOf(p)) ?? { label: "—", icon: null }) : [],
      openHref: `${projectHref}/timeline?task=${id}`,
    };
  };

  const byContent = new Map();
  for (const t of tasks) {
    const k = idOf(t.content);
    if (!byContent.has(k)) byContent.set(k, []);
    byContent.get(k).push(t);
  }
  const known = new Set(contents.map((c) => idOf(c._id)));
  const orphanTasks = tasks.filter((t) => !known.has(idOf(t.content))).length;

  return {
    nowMs,
    orphanTasks,
    contents: sortByOrder(contents).map((c) => ({
      id: idOf(c._id),
      numberLabel: contentNumberLabel(c.number),
      name: c.name,
      href: `${projectHref}/content/${idOf(c._id)}`,
      tasks: sortByOrder(byContent.get(idOf(c._id)) ?? []).map(view),
    })),
    // Assignee filter options: owner first, then members (as the header card).
    members: [...new Set([ctx.project.owner, ...(ctx.project.members ?? [])].map(idOf))]
      .map((id) => team.get(id))
      .filter(Boolean)
      .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl })),
  };
}
