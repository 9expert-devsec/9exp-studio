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
  canReorderTasks,
  canView,
  findContentTask,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
} from "@/lib/projects/access";
import { recomputeRollups } from "@/lib/projects/progress";
import { TASK_SEQ, createNumbered, ensureSeq } from "@/lib/projects/sequence";
import { parseTaskForm, parseTaskTitle } from "@/lib/projects/validate";
import { appendedSortOrder, insertAfter, orderWrites, sortByOrder, validateReorder } from "@/lib/projects/order";
import { buildTaskCopy } from "@/lib/tasks/duplicate";
import { searchRelated } from "@/lib/msdb";
import { escapeRegex } from "@/lib/projects/rules";
import { assetRows } from "@/lib/tasks/assetRows";
import { parseTaskDetails, removedPhotoIds } from "@/lib/tasks/details";
import { issueFolderId } from "@/lib/tasks/folderCounter";
import { deleteTaskPhoto, signTaskPhotoUpload, isOwnTaskPhotoId } from "@/lib/cloudinary";
import { ASSET_TASK_TYPE_KEYS, getTaskType, initialStatus, isValidStatus } from "@/lib/tasks/types";
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

/** A content's tasks, order fields only (scoped to content + project). */
const siblingTasks = (project, content) =>
  Task.find({ content: content._id, project: project._id }).select("_id number sortOrder").lean();

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
  // Manually ordered content → append at the end (else ordered by number).
  const sortOrder = appendedSortOrder(await siblingTasks(project, content));

  const task = await createNumbered(TASK_SEQ, content._id, {
    ...(folderId ? { folderId } : {}),
    ...(sortOrder ? { sortOrder } : {}),
    project: project._id,
    content: content._id,
    title,
    type,
    status,
    assetStatus: null, // post: derived at read time (lib/tasks/assets.js), never stored
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
 * Change a task's status (must be valid for its type in the catalog). A post's
 * Status Asset is derived from its Related Assets (lib/tasks/assets.js), never set
 * here; any posted assetStatus is ignored.
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

  await Task.updateOne({ _id: task._id, content: content._id, project: project._id }, { $set: { status } });

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
 * Drag to reorder the tasks of ONE content (display order only; numbers never
 * change). `orderedIds` must be exactly that content's current tasks. Same
 * permission as editing the content (canEditContent).
 */
export async function reorderTasksAction(projectId, contentId, orderedIds) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const project = await findViewableProject(viewer, str(projectId));
  if (!project) return fail(PROJECT_NOT_FOUND);
  const content = await findProjectContent(project, str(contentId));
  if (!content) return fail(CONTENT_NOT_FOUND);
  if (!canReorderTasks(viewer, project, content)) {
    return fail(project.status === "cancelled" ? PROJECT_CANCELLED : "Only the project owner, the item's creator or an admin can reorder its tasks.");
  }

  const current = await siblingTasks(project, content);
  const check = validateReorder(current.map((t) => t._id.toString()), orderedIds);
  if (!check.ok) return fail("The task list changed. Reload the page and try again.");

  await Task.bulkWrite(orderWrites(check.ids, { content: content._id, project: project._id }));
  refresh();
  return { ok: true };
}

/**
 * Duplicate a task (lib/tasks/duplicate.js): same content, next task number,
 * placed right after the original; status reset, " (copy)", no photos, a NEW
 * Folder ID for types that issue one. Same permission as creating that type here.
 */
export async function duplicateTaskAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const { viewer, project, content } = scope;
  if (project.status === "cancelled") return fail(PROJECT_CANCELLED);

  const task = await findContentTask(project, content, str(formData.get("taskId")));
  if (!task) return fail(TASK_NOT_FOUND);
  if (!(await canCreateTask(viewer, project, task.type))) {
    return fail(`You can't create ${getTaskType(task.type)?.label ?? task.type} tasks in this project.`);
  }

  const folderId = await issueFolderId(task.type);
  const copy = await createNumbered(TASK_SEQ, content._id, buildTaskCopy(task, { createdBy: viewer.id, folderId }));
  if (!copy) return fail("Could not number this task — please try again.");

  // Right after the original: (re)write the whole content's order.
  const ordered = sortByOrder(await siblingTasks(project, content)).map((t) => t._id.toString());
  const ids = insertAfter(ordered, task._id.toString(), copy._id.toString());
  await Task.bulkWrite(orderWrites(ids, { content: content._id, project: project._id }));

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
 * Post "Related Assets" picker: Clip / Graphic / Photo / Article tasks from ANY
 * project (ruling: not limited to the viewer's projects), so any signed-in user
 * may search. Title or Folder ID (regex-escaped, case-insensitive), optional type,
 * newest first, max 30. Returns only what the rows show.
 * @param {string} q @param {string} type "" (all) | clip | graphic | photo | article
 */
export async function searchRelatedAssetsAction(q, type) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const types = ASSET_TASK_TYPE_KEYS.includes(str(type)) ? [str(type)] : ASSET_TASK_TYPE_KEYS;
  const term = str(q).trim().slice(0, 100);
  const filter = { type: { $in: types } };
  if (term) {
    const re = new RegExp(escapeRegex(term), "i");
    filter.$or = [{ title: re }, { folderId: re }];
  }
  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .limit(30)
    .select("type status title folderId project assignee")
    .lean();
  return { ok: true, results: await assetRows(tasks) };
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
