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
  taskReadAccess,
  findContentTask,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
} from "@/lib/projects/access";
import { recomputeRollups } from "@/lib/projects/progress";
import { loadTaskPanel } from "@/lib/projects/queries";
import { TASK_SEQ, createNumbered, ensureSeq, logDuplicateKey } from "@/lib/projects/sequence";
import { DuplicateKeyError, duplicateKeyKind, duplicateKeyMessage } from "@/lib/projects/dupKey";
import { canOverrideTaskStatus } from "@/lib/permissions";
import { canTransition, nextHoldMemory, taskHasRelatedAssets } from "@/lib/tasks/transitions";
import { parseTaskForm, parseTaskTitle } from "@/lib/projects/validate";
import { appendedSortOrder, insertAfter, orderWrites, sortByOrder, validateReorder } from "@/lib/projects/order";
import { buildTaskCopy } from "@/lib/tasks/duplicate";
import { deleteActivity, editEntries, editPeopleKeys, loadActivityPage, logActivity } from "@/lib/tasks/activity";
import { peopleNames, resolvePresenters } from "@/lib/tasks/externalPeople";
import { searchRelated } from "@/lib/msdb";
import { escapeRegex } from "@/lib/projects/rules";
import { assetRows } from "@/lib/tasks/assetRows";
import { parseTaskDetails, removedPhotoIds } from "@/lib/tasks/details";
import { createTaskFolder, discardFolder } from "@/lib/tasks/folderCounter";
import { folderSuffixForType, parseFolderId } from "@/lib/tasks/folderId";
import TaskFolder from "@/models/TaskFolder";
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

/** Folder-level texts as pseudo detail fields (activity diff / folderless tasks). */
function folderTextFields(type, texts) {
  if (type === "graphic") return { fileLocation: texts?.location ?? "" };
  if (type === "photo") return { folderName: texts?.name ?? "", folderLocation: texts?.location ?? "" };
  return {};
}

/** A stored task's folder texts: its folder first; Graphic falls back to its legacy details.fileLocation. */
async function currentFolderTexts(task) {
  const folder = task.folderId ? await TaskFolder.findOne({ folderId: task.folderId }).select("name location").lean() : null;
  const d = task.details ?? {};
  if (task.type === "graphic") return { location: folder?.location || d.fileLocation || "" };
  return { name: folder?.name || d.folderName || "", location: folder?.location || d.folderLocation || "" };
}

/**
 * Save the folder texts: on the folder (scoped to this project; every task in it
 * sees them), or — a task with no folder — back into its details. Upsert: a task
 * whose folder hasn't been back-filled yet (scripts/migrate-task-folders.mjs not
 * run) gets its folder created here instead of losing the texts.
 */
async function applyFolderTexts(type, folderId, project, set, details) {
  const suffix = folderId ? parseFolderId(folderId)?.suffix : null;
  if (folderId && suffix) {
    await TaskFolder.updateOne(
      { folderId, project: project._id },
      { $set: set, $setOnInsert: { suffix, createdBy: null } },
      { upsert: true }
    );
    return details;
  }
  return { ...details, ...folderTextFields(type, set) };
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
  const { folder: folderSpec, ...more } = extra.values ?? { details: {}, assignee: null, startAt: null, dueAt: null };
  // Production: new external presenter names → saved ExternalPerson ids (reused by nameKey).
  if (type === "production" && extra.values) more.details.presenters = await resolvePresenters(more.details.presenters, viewer.id);

  // Shared folder (graphic → G, photo → P; rounds 36–37; lib/tasks/folders.js).
  // A Folder ID is issued ONLY for an explicit "New Folder" in Step 2: the ID
  // and its folder are created here, on the server. "Choose Folder" only links an
  // existing folder of this project (validated by the details parser) and saves
  // the folder texts on it. Step 1 only (no Step 2 posted) → no folder at all.
  // If the insert below fails, a new folder is removed (its number is skipped).
  let folderId = null;
  let newFolder = false;
  if (folderSuffixForType(type) && folderSpec) {
    if (folderSpec.mode === "choose") {
      folderId = folderSpec.folderId;
      await TaskFolder.updateOne({ folderId, project: project._id }, { $set: folderSpec.set });
    } else if (folderSpec.mode === "new") {
      folderId = await createTaskFolder(type, { project: project._id, ...folderSpec.set, createdBy: viewer.id });
      newFolder = !!folderId;
    } else {
      // No folder: keep the typed folder texts on the task itself.
      more.details = await applyFolderTexts(type, null, project, folderSpec.set, more.details);
    }
  }
  // Manually ordered content → append at the end (else ordered by number).
  const sortOrder = appendedSortOrder(await siblingTasks(project, content));

  let task;
  try {
    task = await createNumbered(TASK_SEQ, content._id, {
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
      updatedBy: viewer.id,
    });
  } catch (err) {
    // A non-numbering unique clash (round 39): its own message, never "Could not number".
    if (!(err instanceof DuplicateKeyError)) throw err;
    if (newFolder) await discardFolder(folderId);
    return fail(duplicateKeyMessage(err.kind));
  }
  if (!task) {
    if (newFolder) await discardFolder(folderId);
    return fail("Could not number this task — please try again.");
  }
  await logActivity({ task: task._id, project: project._id, actor: viewer.id, type: "created", data: {} });

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
  // Folder (Graphic / Photo, rounds 36–37; lib/tasks/folders.js): a task WITH a
  // folder keeps it or switches to another existing folder of this project +
  // suffix (validated by the parser) — never a new number. A task WITHOUT one
  // may get a NEW folder only on an explicit "New Folder" (the parser returns
  // mode "new" only then). The folder-level texts go to the folder (all its
  // tasks), or back into the details of a task that has no folder.
  let textsBefore = null;
  let textsAfter = null;
  let issuedFolderId = null;
  if (extra.values) {
    const { folder, ...values } = extra.values;
    // Production: new external presenter names → saved ExternalPerson ids (reused by nameKey).
    if (task.type === "production") values.details.presenters = await resolvePresenters(values.details.presenters, viewer.id);
    Object.assign(set, values);
    if (folder) {
      textsBefore = await currentFolderTexts(task);
      let folderId = task.folderId ?? null;
      if (folder.mode === "choose") folderId = folder.folderId;
      else if (folder.mode === "new" && !task.folderId) {
        issuedFolderId = await createTaskFolder(task.type, { project: project._id, ...folder.set, createdBy: viewer.id });
        folderId = issuedFolderId;
      }
      if (folderId !== (task.folderId ?? null)) set.folderId = folderId;
      // A just-created folder already holds the texts.
      set.details = issuedFolderId ? set.details : await applyFolderTexts(task.type, folderId, project, folder.set, set.details);
      textsAfter = folder.set;
    }
  }
  try {
    await Task.updateOne({ _id: task._id, content: content._id, project: project._id }, { $set: { ...set, updatedBy: viewer.id } });
  } catch (err) {
    // e.g. switching to a shared folder while a stale unique folderId index exists (round 39).
    const kind = duplicateKeyKind(err, TASK_SEQ.childKey);
    if (!kind) throw err;
    if (issuedFolderId) await discardFolder(issuedFolderId);
    return fail(duplicateKeyMessage(logDuplicateKey(TASK_SEQ, err, kind).kind));
  }

  // Activity: what actually changed (nothing → no entry). Folder texts are
  // compared as pseudo details ("File Location", "Folder Name", "Folder Location").
  const before = textsBefore ? { ...task, details: { ...task.details, ...folderTextFields(task.type, textsBefore) } } : task;
  const after = { ...task, ...set, ...(textsAfter ? { details: { ...set.details, ...folderTextFields(task.type, textsAfter) } } : {}) };
  const peopleKeys = editPeopleKeys(before, after);
  const names = peopleKeys.length ? await peopleNames(peopleKeys) : undefined;
  await logActivity(editEntries(before, after, { actor: viewer.id, names }));

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
  if (status === task.status) return { ok: true };

  // Round 40: only the arrows + escape hatches (or an override) — lib/tasks/transitions.js.
  const move = canTransition(task.type, task.status, status, {
    canOverride: canOverrideTaskStatus(viewer, project),
    hasRelatedAssets: taskHasRelatedAssets(task),
    statusBeforeHold: task.statusBeforeHold ?? null,
  });
  if (!move.ok) return fail(move.reason);

  // The status filter makes it atomic: a concurrent change in between → reload.
  const res = await Task.updateOne(
    { _id: task._id, content: content._id, project: project._id, status: task.status },
    {
      $set: {
        status,
        statusBeforeHold: nextHoldMemory(task.type, task.status, status, task.statusBeforeHold ?? null),
        updatedBy: viewer.id,
      },
    }
  );
  if (!res.matchedCount) return fail("This task's status just changed. Reload and try again.");
  await logActivity({
    task: task._id,
    project: project._id,
    actor: viewer.id,
    type: "status_changed",
    data: { from: task.status, to: status, ...(move.kind === "override" ? { override: true } : {}) },
  });

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
  await deleteActivity([task._id]);

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
 * placed right after the original; status reset, " (copy)", no photos, the SAME
 * folder as the original (round 36: no new Folder ID). Same permission as
 * creating that type here.
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

  let copy;
  try {
    copy = await createNumbered(TASK_SEQ, content._id, buildTaskCopy(task, { createdBy: viewer.id }));
  } catch (err) {
    if (!(err instanceof DuplicateKeyError)) throw err;
    return fail(duplicateKeyMessage(err.kind));
  }
  if (!copy) return fail("Could not number this task — please try again.");
  await logActivity({ task: copy._id, project: project._id, actor: viewer.id, type: "created", data: { duplicatedFrom: task.title } });

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
 * Task Detail → Activity: one more page (or a new filter) of a task's activity.
 * Same read rule as the panel (access.js taskReadAccess): the task's project is
 * visible, or the task is a Related Asset of a Post/Article in a visible project
 * (read-only). Reading only — no write is allowed here.
 * @param {string} taskId @param {string} filter all|status|edits|people|assets
 * @param {{ at: string, id: string } | null} cursor
 */
export async function loadTaskActivityAction(taskId, filter, cursor) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const id = str(taskId);
  if (!/^[a-f0-9]{24}$/i.test(id)) return fail(TASK_NOT_FOUND);
  const task = await Task.findById(id).select("type project").lean();
  if (!task) return fail(TASK_NOT_FOUND);
  if ((await taskReadAccess(viewer, task)).mode === "none") return fail(TASK_NOT_FOUND);
  const page = await loadActivityPage(task, {
    filter: str(filter),
    cursor: cursor && typeof cursor === "object" ? { at: str(cursor.at), id: str(cursor.id) } : null,
  });
  return { ok: true, ...page };
}

/**
 * Task Detail panel data for one task id (round 35: loaded on the client, so an
 * open/close never re-renders the page). Same read rule as loadTaskPanel /
 * taskReadAccess — `panel: null` = "Task not found". Reading only.
 * @param {string} taskId
 */
export async function loadTaskPanelAction(taskId) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  return { ok: true, panel: await loadTaskPanel(viewer, str(taskId)) };
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
