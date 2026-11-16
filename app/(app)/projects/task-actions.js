"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the three task actions; helpers stay module-private.
//
// Each action re-reads the viewer from the DB, re-loads the project with
// findViewableProject (missing / not viewable → "not found"), loads the content
// ONLY within that project (findProjectContent) and the task ONLY within that
// content + project (findContentTask), then re-checks lib/projects/access.js.
// Type and status keys are validated against the catalog (lib/tasks/types.js).
// Every write is followed by recomputeRollups().

import { refresh } from "next/cache";
import {
  canChangeTaskStatus,
  canCreateTask,
  canDeleteTask,
  findContentTask,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
} from "@/lib/projects/access";
import { recomputeRollups } from "@/lib/projects/progress";
import { TASK_SEQ, createNumbered, ensureSeq } from "@/lib/projects/sequence";
import { parseTaskForm } from "@/lib/projects/validate";
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

/**
 * Create Task, Step 1 (title + type). Status = the type's initial status (post
 * also gets the initial Status Asset); no assignee / due date yet. A disabled type
 * (production) or one the viewer's role can't create is rejected even if posted.
 */
export async function createTaskAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const { viewer, project, content } = scope;
  if (project.status === "cancelled") return fail(PROJECT_CANCELLED);

  const parsed = parseTaskForm(formData);
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);
  const { title, type } = parsed.values;
  if (!canCreateTask(viewer, project, type)) {
    return fail(CHECK_FIELDS, { type: "You can't create this type of task." });
  }

  const status = initialStatus(type);
  if (!isValidStatus(type, status)) return fail(CHECK_FIELDS, { type: "This task type isn't available yet." });

  const task = await createNumbered(TASK_SEQ, content._id, {
    project: project._id,
    content: content._id,
    title,
    type,
    status,
    assetStatus: hasAssetStatus(type) ? initialAssetStatus(type) : null,
    assignee: null,
    dueDate: null,
    createdBy: viewer.id,
  });
  if (!task) return fail("Could not number this task — please try again.");

  await recomputeRollups({ projectId: project._id, contentId: content._id });
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

  await recomputeRollups({ projectId: project._id, contentId: content._id });
  refresh();
  return { ok: true };
}
