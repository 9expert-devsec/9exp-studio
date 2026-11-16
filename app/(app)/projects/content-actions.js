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
import { parseContentForm } from "@/lib/projects/validate";
import Content from "@/models/Content";
import Project from "@/models/Project";

const fail = (error, fieldErrors) => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });
const str = (v) => (typeof v === "string" ? v : "");
const SIGNED_OUT = "Your session has expired. Please sign in again.";
const PROJECT_NOT_FOUND = "That project no longer exists.";
const CONTENT_NOT_FOUND = "That content item no longer exists.";
const PROJECT_CANCELLED = "This project is cancelled. Reopen it to change its content.";
const NOT_ALLOWED = "Only the project owner, the item's creator or an admin can do this.";
const CHECK_FIELDS = "Please fix the highlighted fields.";
const NUMBER_ATTEMPTS = 3;

// Counter writes must not bump the project's updatedAt (it orders the projects list).
const NO_TIMESTAMPS = { timestamps: false };

/**
 * Make sure Project.contentSeq exists. Projects from before the counter get it set
 * ONCE to their current max content number; the update is conditional on the field
 * still being missing, so concurrent initialisers can't overwrite a live counter.
 * Called before every create AND before every delete, so a legacy project's
 * highest number is recorded before it can be deleted (never reused).
 */
async function ensureContentSeq(projectId) {
  if (await Project.exists({ _id: projectId, contentSeq: { $exists: true } })) return;
  const last = await Content.findOne({ project: projectId }).sort({ number: -1 }).select("number").lean();
  await Project.updateOne(
    { _id: projectId, contentSeq: { $exists: false } },
    { $set: { contentSeq: last?.number ?? 0 } },
    NO_TIMESTAMPS
  );
}

/** Atomically hand out the next number for this project. */
async function nextContentNumber(projectId) {
  await ensureContentSeq(projectId);
  const updated = await Project.findOneAndUpdate(
    { _id: projectId },
    { $inc: { contentSeq: 1 } },
    { returnDocument: "after", projection: { contentSeq: 1 }, ...NO_TIMESTAMPS }
  ).lean();
  return updated?.contentSeq ?? null;
}

export async function createContentAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return fail(PROJECT_NOT_FOUND);
  if (!canAddContent(viewer, project)) return fail(PROJECT_CANCELLED);

  const parsed = parseContentForm(formData);
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);

  // The counter makes duplicates impossible in normal operation; the unique
  // {project, number} index is the backstop (E11000 → take the next number).
  let created = false;
  for (let attempt = 0; attempt < NUMBER_ATTEMPTS && !created; attempt++) {
    const number = await nextContentNumber(project._id);
    if (!number) return fail(PROJECT_NOT_FOUND);
    try {
      await Content.create({
        ...parsed.values,
        project: project._id,
        number,
        status: "open",
        createdBy: viewer.id,
      });
      created = true;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
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

  // Scoped to the project again; number, status and createdBy are never edited here.
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
  await ensureContentSeq(project._id);

  // TODO(tasks round): when Tasks exist, delete this content's tasks here too
  // (cascade, ideally in a transaction with the content delete below).
  await Content.deleteOne({ _id: content._id, project: project._id });

  if (str(formData.get("then")) === "project") redirect(`/projects/${project._id}`);
  refresh();
  return { ok: true };
}
