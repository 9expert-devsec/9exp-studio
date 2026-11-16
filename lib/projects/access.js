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
// Every server action re-checks these itself; hiding buttons is only UX.

import "server-only";
import mongoose from "mongoose";
import { SUPERADMIN, getActiveUser } from "@/lib/team";
import Content from "@/models/Content";
import Project from "@/models/Project";
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
