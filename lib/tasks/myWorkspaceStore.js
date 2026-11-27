// My Workspace (round 58) — DB side of the two cards. Server only. Rules:
// lib/tasks/myWorkspace.js; the table / calendar / chips are the All Tasks loader
// with scope "mine" (lib/tasks/allTasks.js).
//
//   Work Plan วันนี้  MY plans + logs (models/TaskWorkEntry.js) dated today (Bangkok)
//                    on tasks of visible projects. Overnight linked plans are
//                    already stored per day (round 57.1), so "today" is one date.
//                    Photo adds nothing (no Work Plan since round 57.1).
//   รอฉันตรวจ        open review cycles (models/TaskReview.js) with a section
//                    assigned to me and still "pending".

import "server-only";
import { bkkDayKey } from "@/lib/tasks/allTasksFilters";
import { pendingReviews, planCountsByTask, todayTotals } from "@/lib/tasks/myWorkspace";
import { SHOOT_PLAN_SOURCE } from "@/lib/tasks/shootSessions";
import Task from "@/models/Task";
import TaskReview from "@/models/TaskReview";
import TaskWorkEntry from "@/models/TaskWorkEntry";

const idOf = (v) => (v ? String(v) : "");

/**
 * @param {object} viewer getProjectViewer()
 * @param {unknown[]} projectIds the viewer's visible projects
 * @returns {Promise<{ todayKey, workPlan: { entries, totals }, planCounts: Map<string, number>, reviews: { count, latest } }>}
 */
export async function loadMyWorkspaceCards(viewer, projectIds) {
  const todayKey = bkkDayKey(Date.now());
  const [docs, reviewDocs] = await Promise.all([
    TaskWorkEntry.find({ person: viewer.id, date: todayKey, project: { $in: projectIds } }).sort({ start: 1 }).lean(),
    TaskReview.find({ status: "open", project: { $in: projectIds }, sections: { $elemMatch: { reviewerId: viewer.id, verdict: "pending" } } })
      .select("status submittedAt sections")
      .lean(),
  ]);
  const tasks = docs.length ? await Task.find({ _id: { $in: [...new Set(docs.map((d) => idOf(d.task)))] } }).select("title type").lean() : [];
  const byId = new Map(tasks.map((t) => [idOf(t._id), t]));
  const entries = docs
    .filter((d) => byId.has(idOf(d.task)) && byId.get(idOf(d.task)).type !== "photo")
    .map((d) => ({
      id: idOf(d._id),
      task: idOf(d.task),
      taskTitle: byId.get(idOf(d.task))?.title ?? "",
      kind: d.kind,
      mode: d.mode,
      start: d.start ?? null,
      end: d.end ?? null,
      minutes: d.minutes,
      linked: d.source === SHOOT_PLAN_SOURCE,
    }));
  return {
    todayKey,
    workPlan: { entries, totals: todayTotals(entries) },
    planCounts: planCountsByTask(entries),
    reviews: pendingReviews(reviewDocs, viewer.idStr),
  };
}
