"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the task actions below; helpers stay module-private.
//
// Each write action re-reads the viewer from the DB, re-loads the project with
// findViewableProject (missing / not viewable → "not found"), loads the content
// ONLY within that project (findProjectContent) and the task ONLY within that
// content + project (findContentTask), then re-checks lib/projects/access.js.
// Type and status keys are validated against the catalog (lib/tasks/types.js);
// Step 2 details (incl. assignee / reviewer eligibility and MSDB snapshots) by
// lib/tasks/details.js. Every write is followed by recomputeRollups().

import { refresh } from "next/cache";
import {
  canChangeTaskStatus,
  canCreateTask,
  canDeleteTask,
  canEditTask,
  canView,
  findContentTask,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
} from "@/lib/projects/access";
import { recomputeRollups } from "@/lib/projects/progress";
import { TASK_SEQ, createNumbered, ensureSeq } from "@/lib/projects/sequence";
import { parseTaskForm, parseTaskTitle } from "@/lib/projects/validate";
import { searchRelated } from "@/lib/msdb";
import { parseTaskDetails, removedPhotoIds } from "@/lib/tasks/details";
import { issueFolderId } from "@/lib/tasks/folderCounter";
import { deleteTaskPhoto, signTaskPhotoUpload, isOwnTaskPhotoId } from "@/lib/cloudinary";
import {
  hasAssetStatus,
  initialAssetStatus,
  initialStatus,
  isValidAssetStatus,
  isValidStatus,
} from "@/lib/tasks/types";
import Task from "@/models/Task";

const fail = (error, fieldErrors) => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });
const str = (v) => (typeof v === "string" ? v : "");
const SIGNED_OUT = "Your session has expired. Please sign in again.";
const PROJECT_NOT_FOUND = "That project no longer exists.";
const CONTENT_NOT_FOUND = "That content item no longer exists.";
const TASK_NOT_FOUND = "That task no longer exists.";
const PROJECT_CANCELLED = "This project is cancelled. Reopen it to change its tasks.";
const CHECK_FIELDS = "Please fix the highlighted fields.";

/** Viewer + project + content from the posted ids, all scoped; or { error }. */
async function loadScope(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return { error: SIGNED_OUT };
  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return { error: PROJECT_NOT_FOUND };
  const content = await findProjectContent(project, str(formData.get("contentId")));
  if (!content) return { error: CONTENT_NOT_FOUND };
  return { viewer, project, content };
}

/** Step 2 was submitted: validate details for `type` (or { skip: true }). */
async function readDetails(formData, type, project, existing, viewer) {
  if (str(formData.get("withDetails")) !== "1") return { skip: true };
  return parseTaskDetails(type, formData.get("details"), { project, existing, viewerId: String(viewer.id) });
}

/** Best-effort Cloudinary cleanup (never blocks or fails the action). */
async function deletePhotos(publicIds) {
  await Promise.all(publicIds.map((id) => deleteTaskPhoto(id)));
}

/**
 * Create a task. Step 1 alone: title + type, the type's initial status (post also
 * gets the initial Status Asset), no assignee / dates. From Step 2
 * (withDetails=1): the same doc also gets details + assignee + startAt/dueAt, in
 * ONE create (atomic). A disabled type (production) or one the viewer's role
 * doesn't work on is rejected even if posted.
 */
export async function createTaskAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const { viewer, project, content } = scope;
  if (project.status === "cancelled") return fail(PROJECT_CANCELLED);

  const parsed = parseTaskForm(formData);
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);
  const { title, type } = parsed.values;
  if (!(await canCreateTask(viewer, project, type))) {
    return fail(CHECK_FIELDS, { type: "You can't create this type of task." });
  }

  const status = initialStatus(type);
  if (!isValidStatus(type, status)) return fail(CHECK_FIELDS, { type: "This task type isn't available yet." });

  const extra = await readDetails(formData, type, project, null, viewer);
  if (extra.errors) return fail(CHECK_FIELDS, extra.errors);
  const more = extra.values ?? { details: {}, assignee: null, startAt: null, dueAt: null };

  // Folder ID (graphic → "YYMM-NNNG"), issued here on the server only. If the
  // insert below fails, the number is skipped, never reused.
  const folderId = await issueFolderId(type);

  const task = await createNumbered(TASK_SEQ, content._id, {
    ...(folderId ? { folderId } : {}),
    project: project._id,
    content: content._id,
    title,
    type,
    status,
    assetStatus: hasAssetStatus(type) ? initialAssetStatus(type) : null,
    assignee: more.assignee,
    startAt: more.startAt,
    dueAt: more.dueAt,
    details: more.details,
    createdBy: viewer.id,
  });
  if (!task) return fail("Could not number this task — please try again.");

  await recomputeRollups({ projectId: project._id, contentId: content._id });
  refresh();
  return { ok: true };
}

/**
 * Edit a task: the title always; from Step 2 (withDetails=1) also details,
 * assignee and timeline. The type is locked after creation; status has its own
 * action.
 */
export async function updateTaskAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const { viewer, project, content } = scope;

  const task = await findContentTask(project, content, str(formData.get("taskId")));
  if (!task) return fail(TASK_NOT_FOUND);
  if (!canEditTask(viewer, project, task)) {
    return fail(
      project.status === "cancelled"
        ? PROJECT_CANCELLED
        : "Only the task's creator, the project owner or an admin can edit it."
    );
  }

  const parsedTitle = parseTaskTitle(formData);
  const extra = await readDetails(formData, task.type, project, task, viewer);
  const errors = { ...(parsedTitle.error ? { title: parsedTitle.error } : {}), ...(extra.errors ?? {}) };
  if (Object.keys(errors).length) return fail(CHECK_FIELDS, errors);

  const set = { title: parsedTitle.title };
  if (extra.values) Object.assign(set, extra.values);
  await Task.updateOne({ _id: task._id, content: content._id, project: project._id }, { $set: set });

  // Photos removed in the form are deleted from Cloudinary only now, after the
  // save (so Cancel never loses a saved photo).
  if (extra.values) await deletePhotos(removedPhotoIds(task.details, extra.values.details));

  refresh();
  return { ok: true };
}

/**
 * Change a task's status (and, for post, its Status Asset). Both keys must be valid
 * for the task's type in the catalog.
 */
export async function changeTaskStatusAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const { viewer, project, content } = scope;

  const task = await findContentTask(project, content, str(formData.get("taskId")));
  if (!task) return fail(TASK_NOT_FOUND);
  if (!canChangeTaskStatus(viewer, project, task)) {
    return fail(
      project.status === "cancelled"
        ? PROJECT_CANCELLED
        : "Only the task's creator or assignee, the project owner or an admin can change its status."
    );
  }

  const status = str(formData.get("status"));
  if (!isValidStatus(task.type, status)) return fail("Choose a status for this task type.");

  const set = { status };
  if (hasAssetStatus(task.type)) {
    const asset = str(formData.get("assetStatus"));
    if (!isValidAssetStatus(task.type, asset)) return fail("Choose an asset status.");
    set.assetStatus = asset;
  }

  await Task.updateOne({ _id: task._id, content: content._id, project: project._id }, { $set: set });

  await recomputeRollups({ projectId: project._id, contentId: content._id });
  refresh();
  return { ok: true };
}

/** Hard delete, reached only through the confirm dialog (task ⋯ → Delete task). */
export async function deleteTaskAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const { viewer, project, content } = scope;

  const task = await findContentTask(project, content, str(formData.get("taskId")));
  if (!task) return fail(TASK_NOT_FOUND);
  if (!canDeleteTask(viewer, project, task)) {
    return fail(
      project.status === "cancelled"
        ? PROJECT_CANCELLED
        : "Only the task's creator, the project owner or an admin can delete it."
    );
  }

  // Record the counter first so this task's number can never be handed out again.
  await ensureSeq(TASK_SEQ, content._id);
  await Task.deleteOne({ _id: task._id, content: content._id, project: project._id });
  await deletePhotos(removedPhotoIds(task.details, {}));

  await recomputeRollups({ projectId: project._id, contentId: content._id });
  refresh();
  return { ok: true };
}

/**
 * Graphic photos: signed params for ONE direct browser upload to Cloudinary
 * (lib/cloudinary.js). Only for a viewer who may create or edit tasks in this
 * project (open, viewable).
 */
export async function signTaskPhotoUploadAction(projectId) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const project = await findViewableProject(viewer, str(projectId));
  if (!project || !canView(viewer, project)) return fail(PROJECT_NOT_FOUND);
  if (project.status === "cancelled") return fail(PROJECT_CANCELLED);
  try {
    return { ok: true, ...signTaskPhotoUpload(String(viewer.id)) };
  } catch {
    return fail("Photo upload isn't available right now.");
  }
}

/**
 * Remove a photo the viewer just uploaded in the form (not yet saved on any
 * task). Saved photos are deleted by the save/delete actions instead.
 */
export async function deleteUnsavedTaskPhotoAction(projectId, publicId) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const project = await findViewableProject(viewer, str(projectId));
  if (!project || !canView(viewer, project)) return fail(PROJECT_NOT_FOUND);
  const id = str(publicId);
  if (!isOwnTaskPhotoId(id, String(viewer.id))) return fail("That photo can't be removed.");
  if (await Task.exists({ "details.photos.publicId": id })) return { ok: true }; // saved: the save handles it
  await deleteTaskPhoto(id);
  return { ok: true };
}

/**
 * Related picker (Step 2): search the MSDB mirror, max 20. Only for a signed-in
 * viewer who can see the project. type: "course" (public + online) | "program" | "skill".
 */
export async function searchRelatedAction(projectId, type, q) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const project = await findViewableProject(viewer, str(projectId));
  if (!project || !canView(viewer, project)) return fail(PROJECT_NOT_FOUND);
  try {
    const results = await searchRelated({ type: str(type), q: str(q) });
    return { ok: true, results };
  } catch {
    return fail("Search is unavailable right now.");
  }
}
