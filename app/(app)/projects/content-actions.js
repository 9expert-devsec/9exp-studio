"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the two content actions; helpers stay module-private.
//
// Like the project actions, each one re-reads the viewer from the DB, re-loads the
// project with findViewableProject (missing / not viewable → "not found"), and
// re-checks lib/projects/access.js. A contentId is only ever looked up together
// with its project (findProjectContent). No delete this round.

import { redirect } from "next/navigation";
import {
  canAddContent,
  canEditContent,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
} from "@/lib/projects/access";
import { parseContentForm } from "@/lib/projects/validate";
import Content from "@/models/Content";

const fail = (error, fieldErrors) => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });
const str = (v) => (typeof v === "string" ? v : "");
const SIGNED_OUT = "Your session has expired. Please sign in again.";
const PROJECT_NOT_FOUND = "That project no longer exists.";
const CONTENT_NOT_FOUND = "That content item no longer exists.";
const PROJECT_CANCELLED = "This project is cancelled. Reopen it to change its content.";
const CHECK_FIELDS = "Please fix the highlighted fields.";
const NUMBER_ATTEMPTS = 5;

export async function createContentAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return fail(PROJECT_NOT_FOUND);
  if (!canAddContent(viewer, project)) return fail(PROJECT_CANCELLED);

  const parsed = parseContentForm(formData);
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);

  // number = max(number in this project) + 1. Two concurrent creates can pick the
  // same number; the unique {project, number} index rejects the second (E11000)
  // and we re-read the max and try again. Numbers are never reused.
  let created = false;
  for (let attempt = 0; attempt < NUMBER_ATTEMPTS && !created; attempt++) {
    const last = await Content.findOne({ project: project._id }).sort({ number: -1 }).select("number").lean();
    try {
      await Content.create({
        ...parsed.values,
        project: project._id,
        number: (last?.number ?? 0) + 1,
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
    return fail(
      project.status === "cancelled"
        ? PROJECT_CANCELLED
        : "Only the project owner, the item's creator or an admin can edit this."
    );
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
