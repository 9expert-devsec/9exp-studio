"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the three content actions; helpers stay module-private.
//
// Like the project actions, each one re-reads the viewer from the DB, re-loads the
// project with findViewableProject (missing / not viewable → "not found"), and
// re-checks lib/projects/access.js. A contentId is only ever looked up together
// with its project (findProjectContent).

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAddContent,
  canDeleteContent,
  canEditContent,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
} from "@/lib/projects/access";
import { recomputeRollups } from "@/lib/projects/progress";
import { CONTENT_SEQ, createNumbered, ensureSeq } from "@/lib/projects/sequence";
import { parseContentForm } from "@/lib/projects/validate";
import Content from "@/models/Content";
import Task from "@/models/Task";

const fail = (error, fieldErrors) => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });
const str = (v) => (typeof v === "string" ? v : "");
const SIGNED_OUT = "Your session has expired. Please sign in again.";
const PROJECT_NOT_FOUND = "That project no longer exists.";
const CONTENT_NOT_FOUND = "That content item no longer exists.";
const PROJECT_CANCELLED = "This project is cancelled. Reopen it to change its content.";
const NOT_ALLOWED = "Only the project owner, the item's creator or an admin can do this.";
const CHECK_FIELDS = "Please fix the highlighted fields.";

// Numbering: Project.contentSeq, atomic and never reused (lib/projects/sequence.js).

export async function createContentAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return fail(PROJECT_NOT_FOUND);
  if (!canAddContent(viewer, project)) return fail(PROJECT_CANCELLED);

  const parsed = parseContentForm(formData);
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);

  // A new item has no tasks, so its derived status is "open".
  const created = await createNumbered(CONTENT_SEQ, project._id, {
    ...parsed.values,
    project: project._id,
    status: "open",
    createdBy: viewer.id,
  });
  if (!created) return fail("Could not number this item — please try again.");

  redirect(`/projects/${project._id}`);
}

export async function updateContentAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return fail(PROJECT_NOT_FOUND);

  const content = await findProjectContent(project, str(formData.get("contentId")));
  if (!content) return fail(CONTENT_NOT_FOUND);
  if (!canEditContent(viewer, project, content)) {
    return fail(project.status === "cancelled" ? PROJECT_CANCELLED : NOT_ALLOWED);
  }

  const parsed = parseContentForm(formData);
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);

  // Scoped to the project again; number, status, taskSeq and createdBy are never edited here.
  await Content.updateOne(
    { _id: content._id, project: project._id },
    { $set: parsed.values },
    { runValidators: true }
  );

  redirect(`/projects/${project._id}`);
}

/**
 * Hard delete, reached only through the confirm dialog (DeleteContentDialog).
 * formData: projectId, contentId, and `then`: "project" → redirect to the Content
 * tab (edit/detail pages); otherwise refresh in place (the Content tab list).
 */
export async function deleteContentAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return fail(PROJECT_NOT_FOUND);

  const content = await findProjectContent(project, str(formData.get("contentId")));
  if (!content) return fail(CONTENT_NOT_FOUND);
  if (!canDeleteContent(viewer, project, content)) {
    return fail(project.status === "cancelled" ? PROJECT_CANCELLED : NOT_ALLOWED);
  }

  // Record the counter first so this item's number can never be handed out again.
  await ensureSeq(CONTENT_SEQ, project._id);

  // Cascade: its tasks first, then the item, then re-derive the project's status.
  // (Not a transaction: a failure between the two deletes leaves an item with
  // fewer tasks, never orphaned tasks.)
  await Task.deleteMany({ content: content._id, project: project._id });
  await Content.deleteOne({ _id: content._id, project: project._id });
  await recomputeRollups({ projectId: project._id });

  if (str(formData.get("then")) === "project") redirect(`/projects/${project._id}`);
  refresh();
  return { ok: true };
}
