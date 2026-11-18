// Project access: the ONE place these rules live. Server only.
//
// "Admin" = the same check that gates Team Management: an active user whose DB doc
// has role "superadmin" and no pending mustChangePassword (lib/team.js). Per-role
// permissions are still pending, so this stays deliberately simple:
//   canCreate          any signed-in (active) account
//   canView            admin, owner, or member
//   canEdit/Cancel/Reopen  admin or owner
//   list               admin: all; others: owner OR member
//   canAddContent      anyone who can view, while the project is not cancelled
//   canEditContent     admin, project owner, or the content's creator; not cancelled
//   canDeleteContent   same as canEditContent
//   canCreateTask      can view, not cancelled, type enabled, role allows the type
//   canChangeTaskStatus  admin, owner, task creator or assignee; not cancelled
//   canEditTask        admin, owner or task creator; not cancelled
//   canDeleteTask      admin, owner or task creator; not cancelled
//   taskEligibility    who may be assignee / content reviewer / video reviewer
// Every server action re-checks these itself; hiding buttons is only UX.

import "server-only";
import mongoose from "mongoose";
import { SUPERADMIN, getActiveUser } from "@/lib/team";
import Content from "@/models/Content";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";
import { hasPermission, roleWorksOnType } from "@/lib/permissions";
import { enabledTaskTypes, isTaskTypeEnabled } from "@/lib/tasks/types";
import { canCancelStatus, canReopenStatus } from "./status";

/** The current user for project checks, or null when signed out/inactive/must change password. */
export async function getProjectViewer() {
  const me = await getActiveUser();
  if (!me) return null;
  return { id: me._id, idStr: me._id.toString(), isAdmin: me.role === SUPERADMIN, user: me };
}

const sameId = (a, b) => !!a && !!b && a.toString() === b.toString();

export const isOwner = (viewer, project) => sameId(project.owner, viewer.id);
export const isMember = (viewer, project) => (project.members ?? []).some((m) => sameId(m, viewer.id));

export const canCreate = (viewer) => !!viewer;
export const canView = (viewer, project) =>
  !!viewer && (viewer.isAdmin || isOwner(viewer, project) || isMember(viewer, project));
export const canEdit = (viewer, project) => !!viewer && (viewer.isAdmin || isOwner(viewer, project));
export const canCancel = (viewer, project) => canEdit(viewer, project) && canCancelStatus(project.status);
export const canReopen = (viewer, project) => canEdit(viewer, project) && canReopenStatus(project.status);

const projectOpen = (project) => project.status !== "cancelled";
export const canAddContent = (viewer, project) => canView(viewer, project) && projectOpen(project);
export const canEditContent = (viewer, project, content) =>
  canView(viewer, project) &&
  projectOpen(project) &&
  (viewer.isAdmin || isOwner(viewer, project) || sameId(content.createdBy, viewer.id));
/** Same rule as editing: admin, project owner or the content's creator; not when cancelled. */
export const canDeleteContent = (viewer, project, content) => canEditContent(viewer, project, content);

// ---------------------------------------------------------------------------
// Tasks

/**
 * Which task types this viewer's ROLE may create: an enabled type the role works
 * on (lib/permissions.js roleWorksOnType: superadmin always; an unconfigured role
 * = all types). The project-membership requirement stays in canCreateTask
 * (canView). The drawer (disabled cards), the create action and "+ Add task" all
 * go through canCreateTask().
 */
export async function roleAllowsTaskType(viewer, type) {
  return !!viewer && isTaskTypeEnabled(type) && (await roleWorksOnType(viewer.user, type));
}

/** View the project, project not cancelled, type enabled, and the role allows it. */
export async function canCreateTask(viewer, project, type) {
  return canView(viewer, project) && projectOpen(project) && isTaskTypeEnabled(type) && (await roleAllowsTaskType(viewer, type));
}

/** The enabled type keys this viewer may create in this project ([] → no "+ Add task"). */
export async function creatableTaskTypes(viewer, project) {
  const keys = enabledTaskTypes().map((t) => t.key);
  const ok = await Promise.all(keys.map((key) => canCreateTask(viewer, project, key)));
  return keys.filter((_, i) => ok[i]);
}

const isTaskCreator = (viewer, task) => sameId(task.createdBy, viewer.id);

/** Edit a task (title, details): admin, project owner or the task's creator; not cancelled. */
export const canEditTask = (viewer, project, task) =>
  canView(viewer, project) && projectOpen(project) && (viewer.isAdmin || isOwner(viewer, project) || isTaskCreator(viewer, task));

/**
 * The project's people (owner + members) as ACTIVE User docs, owner first.
 * Candidate pool for assignees and reviewers.
 */
async function projectPeople(project) {
  const ids = [project.owner, ...(project.members ?? [])];
  const users = await User.find({ _id: { $in: ids }, isActive: true }).select("name email role avatar.url").lean();
  return users.sort((a, b) => (sameId(a._id, project.owner) ? -1 : sameId(b._id, project.owner) ? 1 : a.name.localeCompare(b.name)));
}

/**
 * Eligible people for a task of `type`, as id-string sets (also enforced on save):
 *   assignee        owner + members whose role works on `type`
 *   contentReviewer owner + members with "review_content"
 *   videoReviewer   owner + members with "review_video"
 *   designReviewer  owner + members with "review_design"
 * The owner is always eligible; superadmins and unconfigured roles pass
 * (lib/permissions.js). Returns the User docs too, for the pickers.
 */
export async function taskEligibility(project, type) {
  const people = await projectPeople(project);
  const isOwnerDoc = (u) => sameId(u._id, project.owner);
  const [works, content, video, design] = await Promise.all([
    Promise.all(people.map((u) => roleWorksOnType(u, type))),
    Promise.all(people.map((u) => hasPermission(u, "review_content"))),
    Promise.all(people.map((u) => hasPermission(u, "review_video"))),
    Promise.all(people.map((u) => hasPermission(u, "review_design"))),
  ]);
  const pick = (flags) => new Set(people.filter((u, i) => isOwnerDoc(u) || flags[i]).map((u) => u._id.toString()));
  return {
    people,
    assignee: pick(works),
    contentReviewer: pick(content),
    videoReviewer: pick(video),
    designReviewer: pick(design),
  };
}

/**
 * Admin, project owner, the task's creator or its assignee. Like content edits,
 * not while the project is cancelled.
 */
export const canChangeTaskStatus = (viewer, project, task) =>
  canView(viewer, project) &&
  projectOpen(project) &&
  (viewer.isAdmin || isOwner(viewer, project) || isTaskCreator(viewer, task) || sameId(task.assignee, viewer.id));

/** Admin, project owner or the task's creator; not while the project is cancelled. */
export const canDeleteTask = (viewer, project, task) =>
  canView(viewer, project) && projectOpen(project) && (viewer.isAdmin || isOwner(viewer, project) || isTaskCreator(viewer, task));

/**
 * A task ONLY if it belongs to this content item AND project (both already scoped
 * by the caller), else null. Both ids are part of the query.
 */
export async function findContentTask(project, content, taskId) {
  if (!project || !content || typeof taskId !== "string" || !mongoose.isValidObjectId(taskId)) return null;
  return Task.findOne({ _id: taskId, content: content._id, project: project._id }).lean();
}

/**
 * A content item ONLY if it belongs to this (already viewable) project, else null
 * (callers → notFound()). The project filter is part of the query, so a contentId
 * from another project never loads.
 */
export async function findProjectContent(project, contentId) {
  if (!project || typeof contentId !== "string" || !mongoose.isValidObjectId(contentId)) return null;
  return Content.findOne({ _id: contentId, project: project._id }).lean();
}

/** Mongo filter for the projects a viewer may list. */
export function visibleProjectsFilter(viewer) {
  if (viewer.isAdmin) return {};
  return { $or: [{ owner: viewer.id }, { members: viewer.id }] };
}

/**
 * Load a project the viewer may VIEW, else null (callers → notFound(), so a project
 * the viewer can't see is indistinguishable from one that doesn't exist).
 */
export async function findViewableProject(viewer, id) {
  if (!viewer || typeof id !== "string" || !mongoose.isValidObjectId(id)) return null;
  const project = await Project.findById(id).lean();
  if (!project || !canView(viewer, project)) return null;
  return project;
}
