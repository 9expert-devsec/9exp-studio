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
  canEdit,
  canEditContent,
  canReopen,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
  visibleProjectsFilter,
} from "./access";
import { PROJECT_TYPE_LABEL, contentNumberLabel, formatProjectDate, projectDateLabel } from "./format";
import { contentStats, projectStats } from "./progress";
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

function summarize(project, users, viewer, pinnedSet) {
  const stats = projectStats(project);
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
  const users = await loadUsers(all.flatMap((p) => [p.owner, ...(p.members ?? [])]));
  const summaries = all.map((p) => summarize(p, users, viewer, pinnedSet));
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

  const [pin, users] = await Promise.all([
    ProjectPin.exists({ account: viewer.id, project: project._id }),
    loadUsers([project.owner, ...(project.members ?? [])], { withRoles: true }),
  ]);
  const summary = summarize(project, users, viewer, new Set(pin ? [project._id.toString()] : []));
  const stats = projectStats(project);

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

  const users = await loadUsers([project.owner, ...(project.members ?? [])]);
  const stats = projectStats(project);
  return {
    id: project._id.toString(),
    name: project.name,
    icon: project.icon,
    startDate: toDateInput(project.startDate),
    endDate: toDateInput(project.endDate),
    description: project.description ?? "",
    briefLink: project.briefLink ?? "",
    status: deriveAutoStatus(project, stats.tasks),
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

function contentSummary(content, ctx) {
  const stats = contentStats(content);
  const id = content._id.toString();
  const projectHref = `/projects/${ctx.project._id}`;
  return {
    id,
    number: content.number,
    numberLabel: contentNumberLabel(content.number),
    name: content.name,
    status: deriveContentStatus(content, stats),
    briefLink: content.briefLink ?? "",
    stats,
    canEdit: canEditContent(ctx.viewer, ctx.project, content),
    editHref: `${projectHref}/content/${id}/edit`,
  };
}

/**
 * Content tab: items of ONE project (number asc) matching the URL filters.
 * Search is server-side (regex-escaped, case-insensitive, name or description);
 * status is matched after derivation (it will come from Tasks).
 * @returns {{ total: number, items: object[], canAdd: boolean }}
 */
export async function loadContentList(ctx, filters) {
  const base = { project: ctx.project._id };
  const re = filters.q ? new RegExp(escapeRegex(filters.q), "i") : null;
  const [total, docs] = await Promise.all([
    Content.countDocuments(base),
    Content.find(re ? { ...base, $or: [{ name: re }, { description: re }] } : base)
      .sort({ number: 1 })
      .lean(),
  ]);

  const items = docs
    .map((c) => contentSummary(c, ctx))
    .filter((c) => !filters.status || c.status === filters.status);

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
  };
}
