"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the content actions; helpers stay module-private.
//
// Like the project actions, each one re-reads the viewer from the DB, re-loads the
// project with findViewableProject (missing / not viewable → "not found"), and
// re-checks lib/projects/access.js. A contentId is only ever looked up together
// with its project (findProjectContent).

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAddContent,
  canCreateTask,
  canDeleteContent,
  canEditContent,
  canReorderContent,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
} from "@/lib/projects/access";
import { appendedSortOrder, insertAfter, orderWrites, sortByOrder, validateReorder } from "@/lib/projects/order";
import { recomputeRollups } from "@/lib/projects/progress";
import { CONTENT_SEQ, createNumbered, ensureSeq, nextSeq } from "@/lib/projects/sequence";
import { duplicateKeyKind, duplicateKeyMessage } from "@/lib/projects/dupKey";
import { parseContentForm } from "@/lib/projects/validate";
import { buildContentCopy, buildTaskCopy } from "@/lib/tasks/duplicate";
import { deleteActivity, logActivity } from "@/lib/tasks/activity";
import { deleteReviews } from "@/lib/tasks/reviewStore";
import { deleteComments } from "@/lib/tasks/comments";
import { deleteWorkEntries } from "@/lib/tasks/workplanStore";
import { getTaskType } from "@/lib/tasks/types";
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

/** A project's content items, order fields only. */
const siblingContents = (project, session = null) =>
  Content.find({ project: project._id }).select("_id number sortOrder").session(session).lean();

/**
 * Drag to reorder the content cards of ONE project (display order only; numbers
 * never change). `orderedIds` must be exactly the project's current items. Same
 * permission as editing the project (admin or owner; not while cancelled).
 */
export async function reorderContentAction(projectId, orderedIds) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const project = await findViewableProject(viewer, str(projectId));
  if (!project) return fail(PROJECT_NOT_FOUND);
  if (!canReorderContent(viewer, project)) {
    return fail(project.status === "cancelled" ? PROJECT_CANCELLED : "Only the project owner or an admin can reorder content.");
  }

  const current = await siblingContents(project);
  const check = validateReorder(current.map((c) => c._id.toString()), orderedIds);
  if (!check.ok) return fail("The content list changed. Reload the page and try again.");

  await Content.bulkWrite(orderWrites(check.ids, { project: project._id }));
  refresh();
  return { ok: true };
}

/**
 * Duplicate a content item AND all its tasks (lib/tasks/duplicate.js), in ONE
 * MongoDB transaction: a failure leaves no half-copied content. The new item gets
 * the next content number and sits right after the original; its tasks keep the
 * original's order, numbered 1..n, each reset like a task duplicate (Graphic /
 * Photo: the SAME shared folder, round 36). The content number is taken BEFORE
 * the transaction: an aborted copy just skips it (never reused).
 * Permission: may add content here AND may create every task type being copied.
 */
export async function duplicateContentAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);
  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return fail(PROJECT_NOT_FOUND);
  if (!canAddContent(viewer, project)) return fail(PROJECT_CANCELLED);
  const content = await findProjectContent(project, str(formData.get("contentId")));
  if (!content) return fail(CONTENT_NOT_FOUND);

  const tasks = sortByOrder(await Task.find({ content: content._id, project: project._id }).lean());
  for (const type of new Set(tasks.map((t) => t.type))) {
    if (!(await canCreateTask(viewer, project, type))) {
      return fail(`You can't create ${getTaskType(type)?.label ?? type} tasks in this project, so this content can't be duplicated.`);
    }
  }

  const number = await nextSeq(CONTENT_SEQ, project._id);
  if (!number) return fail("Could not number this item — please try again.");
  // Copies keep their original's shared folder (round 36; buildTaskCopy): no new Folder IDs.

  const session = await mongoose.startSession();
  let newId = null;
  let copies = [];
  try {
    await session.withTransaction(async () => {
      const [created] = await Content.create(
        [{ ...buildContentCopy(content, { createdBy: viewer.id }), number, taskSeq: tasks.length }],
        { session }
      );
      newId = created._id;
      if (tasks.length) {
        copies = await Task.insertMany(
          tasks.map((t, i) => ({
            ...buildTaskCopy(t, { createdBy: viewer.id, content: created._id }),
            number: i + 1,
            sortOrder: i + 1,
          })),
          { session }
        );
      }
      const ordered = sortByOrder(await siblingContents(project, session)).map((c) => c._id.toString());
      const ids = insertAfter(ordered, content._id.toString(), created._id.toString());
      await Content.bulkWrite(orderWrites(ids, { project: project._id }), { session });
    });
  } catch (err) {
    console.error(`[content] duplicate failed: ${err?.message ?? "unknown error"}`, err?.code === 11000 ? { keyPattern: err.keyPattern, keyValue: err.keyValue } : "");
    // A stale unique folderId index blocks copies that share a folder (round 39).
    if (duplicateKeyKind(err, "content") === "folder") return fail(duplicateKeyMessage("folder"));
    return fail("Could not duplicate this content — nothing was copied. Please try again.");
  } finally {
    await session.endSession();
  }

  // Activity (after the commit): each copied task was "created … duplicated from".
  await logActivity(
    copies.map((c, i) => ({
      task: c._id,
      project: project._id,
      actor: viewer.id,
      type: "created",
      data: { duplicatedFrom: tasks[i].title },
    }))
  );

  await recomputeRollups({ projectId: project._id, contentId: newId });
  refresh();
  return { ok: true };
}

export async function createContentAction(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return fail(SIGNED_OUT);

  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return fail(PROJECT_NOT_FOUND);
  if (!canAddContent(viewer, project)) return fail(PROJECT_CANCELLED);

  const parsed = parseContentForm(formData);
  if (parsed.errors) return fail(CHECK_FIELDS, parsed.errors);

  // A new item has no tasks, so its derived status is "open". Manually ordered
  // project → append at the end (else ordered by number).
  const sortOrder = appendedSortOrder(await siblingContents(project));
  const created = await createNumbered(CONTENT_SEQ, project._id, {
    ...(sortOrder ? { sortOrder } : {}),
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
  const taskIds = (await Task.find({ content: content._id, project: project._id }).select("_id").lean()).map((t) => t._id);
  await Task.deleteMany({ content: content._id, project: project._id });
  await deleteActivity(taskIds);
  await deleteReviews(taskIds);
  await deleteComments(taskIds);
  await deleteWorkEntries(taskIds);
  await Content.deleteOne({ _id: content._id, project: project._id });
  await recomputeRollups({ projectId: project._id });

  if (str(formData.get("then")) === "project") redirect(`/projects/${project._id}`);
  refresh();
  return { ok: true };
}
