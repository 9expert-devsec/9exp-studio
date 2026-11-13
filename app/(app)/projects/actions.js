"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the six project actions; helpers stay module-private.
//
// Every action re-reads the viewer from the DB (getProjectViewer: active, no pending
// password change; "admin" = superadmin) and re-checks project access itself
// (lib/projects/access.js). Hiding buttons in the UI is only a convenience.
// No hard delete exists.

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  canCancel,
  canCreate,
  canEdit,
  canReopen,
  findViewableProject,
  getProjectViewer,
} from "@/lib/projects/access";
import { PROJECT_PIN_MAX } from "@/lib/projects/rules";
import { reopenedStatus } from "@/lib/projects/status";
import { projectStats } from "@/lib/projects/progress";
import { parseProjectForm } from "@/lib/projects/validate";
import Project from "@/models/Project";
import ProjectPin from "@/models/ProjectPin";
import User from "@/models/User";

const fail = (error, fieldErrors) => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });
const str = (v) => (typeof v === "string" ? v : "");
const SIGNED_OUT = "Your session has expired. Please sign in again.";
const NOT_FOUND = "That project no longer exists.";
const NOT_ALLOWED = "Only the project owner or an admin can do this.";
const CHECK_FIELDS = "Please fix the highlighted fields.";

export async function createProjectAction(formData) {
  const viewer = await getProjectViewer();
  if (!canCreate(viewer)) return fail(SIGNED_OUT);

  const parsed = await parseProjectForm(formData, { ownerId: viewer.id });
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);

  // Owner and creator are always the viewer; status always starts "open".
  const project = await Project.create({
    ...parsed.values,
    owner: viewer.id,
    createdBy: viewer.id,
    status: "open",
  });

  redirect(`/projects/${project._id}`);
}

export async function updateProjectAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("id")));
  if (!project) return fail(NOT_FOUND);
  if (!canEdit(viewer, project)) return fail(NOT_ALLOWED);

  const parsed = await parseProjectForm(formData, {
    ownerId: project.owner,
    existingMembers: project.members ?? [],
  });
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);

  // Owner, status and cancellation fields are not editable here. endDate is null
  // for ongoing (parseProjectForm clears it when the type switches).
  await Project.updateOne({ _id: project._id }, { $set: parsed.values }, { runValidators: true });

  redirect(`/projects/${project._id}`);
}

export async function cancelProjectAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("id")));
  if (!project) return fail(NOT_FOUND);
  if (!canCancel(viewer, project)) {
    return fail(project.status === "cancelled" ? "This project is already cancelled." : NOT_ALLOWED);
  }

  await Project.updateOne(
    { _id: project._id, status: { $ne: "cancelled" } },
    { $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: viewer.id } }
  );

  refresh();
  return { ok: true };
}

export async function reopenProjectAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("id")));
  if (!project) return fail(NOT_FOUND);
  if (!canReopen(viewer, project)) {
    return fail(project.status !== "cancelled" ? "This project is not cancelled." : NOT_ALLOWED);
  }

  await Project.updateOne(
    { _id: project._id, status: "cancelled" },
    {
      $set: {
        status: reopenedStatus(project, projectStats(project).tasks),
        cancelledAt: null,
        cancelledBy: null,
      },
    }
  );

  refresh();
  return { ok: true };
}

// Pin/unpin for the CURRENT viewer. Max 2 pins per account (server-enforced).
export async function togglePinAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("id")));
  if (!project) return fail(NOT_FOUND);

  const removed = await ProjectPin.deleteOne({ account: viewer.id, project: project._id });
  if (removed.deletedCount > 0) {
    refresh();
    return { ok: true, pinned: false };
  }

  if ((await ProjectPin.countDocuments({ account: viewer.id })) >= PROJECT_PIN_MAX) {
    return fail(`You can pin up to ${PROJECT_PIN_MAX} projects. Unpin one first.`);
  }
  try {
    await ProjectPin.create({ account: viewer.id, project: project._id });
  } catch (err) {
    if (err?.code !== 11000) throw err; // already pinned (double click): fine
  }

  refresh();
  return { ok: true, pinned: true };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Member search for the project form: ACTIVE accounts by name or email, max 8.
// `exclude` (owner + already-selected ids) only narrows results; the save action
// re-validates members and strips the owner regardless.
export async function searchAccountsAction(query, exclude = []) {
  const viewer = await getProjectViewer();
  if (!viewer) return { ok: false, error: SIGNED_OUT, results: [] };

  const q = str(query).trim().slice(0, 100);
  if (!q) return { ok: true, results: [] };

  const excludeIds = (Array.isArray(exclude) ? exclude : [])
    .map(str)
    .filter((id) => mongoose.isValidObjectId(id))
    .slice(0, 200);
  const re = new RegExp(escapeRegex(q), "i");

  const users = await User.find({
    isActive: true,
    _id: { $nin: excludeIds },
    $or: [{ name: re }, { email: re }],
  })
    .select("name email avatar.url")
    .sort({ name: 1 })
    .limit(8)
    .lean();

  return {
    ok: true,
    results: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      avatarUrl: u.avatar?.url ?? null,
    })),
  };
}
