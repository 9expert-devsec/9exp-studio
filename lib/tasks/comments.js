// Task Detail → Comments (round 46) — DB side. Server only.
//
// Rules:
//   read    anyone with panel access (access.js taskReadAccess: full or read_only)
//   write   full access only (a read-only viewer — a Related Asset from a project
//           they're not in — sees the list without the composer)
//   edit    the author, own comment, not deleted
//   delete  the author, or full access (Manager / superadmin); a SOFT delete
//           (shown as "ความคิดเห็นถูกลบ")
// No Activity entries. Deleted with the task.

import "server-only";
import { formatTaskDateTime, relativeTimeLabel } from "@/lib/projects/format";
import TaskComment from "@/models/TaskComment";
import User from "@/models/User";

const idOf = (v) => (v ? String(v) : "");
export const COMMENTS_MAX_SHOWN = 500;

export const canEditComment = (viewer, c) => !!viewer && !c.deletedAt && idOf(c.author) === viewer.idStr;
export const canDeleteComment = (viewer, c) => !!viewer && !c.deletedAt && (idOf(c.author) === viewer.idStr || !!viewer.isAdmin);

/**
 * The task's comments, oldest first, shaped for the tab.
 * @returns {Promise<{ items: object[], count: number, canComment: boolean }>}
 */
export async function loadComments(task, viewer, { canComment }) {
  const docs = await TaskComment.find({ task: task._id }).sort({ createdAt: 1, _id: 1 }).limit(COMMENTS_MAX_SHOWN).lean();
  const ids = [...new Set(docs.map((c) => idOf(c.author)))];
  const users = ids.length ? await User.find({ _id: { $in: ids } }).select("name avatar.url").lean() : [];
  const byId = new Map(users.map((u) => [idOf(u._id), u]));
  const now = Date.now();
  const items = docs.map((c) => {
    const u = byId.get(idOf(c.author));
    const deleted = !!c.deletedAt;
    return {
      id: idOf(c._id),
      authorName: u?.name ?? "Unknown account",
      avatarUrl: u?.avatar?.url ?? null,
      text: deleted ? "" : c.text,
      at: new Date(c.createdAt).toISOString(),
      relLabel: relativeTimeLabel(c.createdAt, now),
      fullLabel: formatTaskDateTime(c.createdAt),
      edited: !deleted && !!c.editedAt,
      deleted,
      canEdit: canComment && canEditComment(viewer, c),
      canDelete: canComment && canDeleteComment(viewer, c),
    };
  });
  return { items, count: items.filter((c) => !c.deleted).length, canComment };
}

/** Delete every comment of these tasks (task / content delete); never throws. */
export async function deleteComments(taskIds) {
  if (!taskIds.length) return;
  try {
    await TaskComment.deleteMany({ task: { $in: taskIds } });
  } catch (err) {
    console.error(`[comments] delete failed: ${err?.message ?? "unknown error"}`);
  }
}
