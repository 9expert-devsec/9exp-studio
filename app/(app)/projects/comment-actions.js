"use server";

// Task Detail → Comments (round 46). Every export is a public POST endpoint:
// export ONLY the actions below. Rules: lib/tasks/comments.js. No Activity entries.

import mongoose from "mongoose";
import { getProjectViewer, taskReadAccess } from "@/lib/projects/access";
import { canDeleteComment, canEditComment } from "@/lib/tasks/comments";
import Task from "@/models/Task";
import TaskComment, { COMMENT_MAX } from "@/models/TaskComment";

const fail = (error) => ({ ok: false, error });
const str = (v) => (typeof v === "string" ? v : "");
const SIGNED_OUT = "Your session has expired. Please sign in again.";
const NOT_FOUND = "That task no longer exists.";
const GONE = "This comment no longer exists.";

/** Clean comment text: line breaks kept, trimmed, 1..COMMENT_MAX chars; or { error }. */
function cleanText(raw) {
  const text = str(raw).replace(/\r\n?/g, "\n").trim();
  if (!text) return { error: "เขียนความคิดเห็นก่อนส่ง" };
  if (text.length > COMMENT_MAX) return { error: `ไม่เกิน ${COMMENT_MAX} ตัวอักษร` };
  return { text };
}

/** Viewer + task with FULL access (read-only viewers can't write), or { error }. */
async function writableTask(taskId) {
  const viewer = await getProjectViewer();
  if (!viewer) return { error: SIGNED_OUT };
  const id = str(taskId);
  if (!mongoose.isValidObjectId(id)) return { error: NOT_FOUND };
  const task = await Task.findById(id).select("type project").lean();
  if (!task) return { error: NOT_FOUND };
  const access = await taskReadAccess(viewer, task);
  if (access.mode === "none") return { error: NOT_FOUND };
  if (access.mode !== "full") return { error: "You can view this task but not comment on it." };
  return { viewer, task };
}

/** A comment of a task the viewer may write to, or { error }. */
async function writableComment(commentId) {
  const id = str(commentId);
  if (!mongoose.isValidObjectId(id)) return { error: GONE };
  const comment = await TaskComment.findById(id).lean();
  if (!comment) return { error: GONE };
  const scope = await writableTask(String(comment.task));
  if (scope.error) return scope;
  return { ...scope, comment };
}

export async function addCommentAction(taskId, text) {
  const scope = await writableTask(taskId);
  if (scope.error) return fail(scope.error);
  const t = cleanText(text);
  if (t.error) return fail(t.error);
  await TaskComment.create({ task: scope.task._id, project: scope.task.project, author: scope.viewer.id, text: t.text });
  return { ok: true };
}

/** The author edits their own (not deleted) comment. */
export async function editCommentAction(commentId, text) {
  const scope = await writableComment(commentId);
  if (scope.error) return fail(scope.error);
  if (!canEditComment(scope.viewer, scope.comment)) return fail("You can only edit your own comments.");
  const t = cleanText(text);
  if (t.error) return fail(t.error);
  if (t.text === scope.comment.text) return { ok: true };
  await TaskComment.updateOne({ _id: scope.comment._id, deletedAt: null }, { $set: { text: t.text, editedAt: new Date() } });
  return { ok: true };
}

/** Soft delete: the author, or Manager / superadmin. */
export async function deleteCommentAction(commentId) {
  const scope = await writableComment(commentId);
  if (scope.error) return fail(scope.error);
  if (!canDeleteComment(scope.viewer, scope.comment)) return fail("You can't delete this comment.");
  await TaskComment.updateOne({ _id: scope.comment._id, deletedAt: null }, { $set: { deletedAt: new Date(), deletedBy: scope.viewer.id } });
  return { ok: true };
}
