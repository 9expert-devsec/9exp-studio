// Review cycles (round 46) — DB side. Server only. Rules: lib/tasks/reviews.js.

import "server-only";
import { logActivity } from "@/lib/tasks/activity";
import { isReviewType, REVIEW_STATUS } from "@/lib/tasks/reviews";
import TaskReview from "@/models/TaskReview";

/** The task's cycles, newest first (lean). */
export const loadCycles = (taskId) => TaskReview.find({ task: taskId }).sort({ cycleNo: -1 }).lean();

/**
 * The status just LEFT รอตรวจ by a user move (back / pause / cancel / override):
 * close the open cycle as withdrawn ("ยกเลิกการส่งตรวจ") and log it. Never throws.
 */
export async function withdrawOpenCycle(task, { from, to, actor }) {
  if (!isReviewType(task.type) || from !== REVIEW_STATUS.review || to === REVIEW_STATUS.review) return;
  try {
    const cycle = await TaskReview.findOneAndUpdate(
      { task: task._id, status: "open" },
      { $set: { status: "withdrawn", closedAt: new Date(), closedBy: actor } },
      { new: true }
    ).lean();
    if (!cycle) return;
    await logActivity({ task: task._id, project: task.project, actor, type: "review_withdrawn", data: { cycleNo: cycle.cycleNo, to } });
  } catch (err) {
    console.error(`[reviews] withdraw failed for task ${String(task._id)}: ${err?.message ?? "unknown error"}`);
  }
}

/** Delete every cycle of these tasks (task / content delete); never throws. */
export async function deleteReviews(taskIds) {
  if (!taskIds.length) return;
  try {
    await TaskReview.deleteMany({ task: { $in: taskIds } });
  } catch (err) {
    console.error(`[reviews] delete failed: ${err?.message ?? "unknown error"}`);
  }
}
