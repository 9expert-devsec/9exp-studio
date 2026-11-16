// Project / content progress from real tasks, and the ONE roll-up writer.
// Server only.
//
// Counts are by status GROUP (lib/tasks/types.js statusGroup):
//   all        every task, cancelled included ("{n} tasks" on the content page)
//   total      tasks NOT cancelled (the denominator: "x/y Tasks", percent)
//   completed / inProgress / open / cancelled   per group
//   percent    round(completed / total * 100); 0 when total = 0

import "server-only";
import mongoose from "mongoose";
import Content from "@/models/Content";
import Project from "@/models/Project";
import Task from "@/models/Task";
import { statusGroup } from "@/lib/tasks/types";
import { deriveContentStatus, deriveStatusFromCounts } from "./status";

const GROUP_FIELD = { open: "open", in_progress: "inProgress", completed: "completed", cancelled: "cancelled" };
const NO_TIMESTAMPS = { timestamps: false };

export const emptyCounts = () => ({ all: 0, total: 0, completed: 0, inProgress: 0, open: 0, cancelled: 0, percent: 0 });

function add(counts, type, status, n) {
  const field = GROUP_FIELD[statusGroup(type, status)] ?? "open";
  counts[field] += n;
  counts.all += n;
  if (field !== "cancelled") counts.total += n;
}

const withPercent = (c) => ({ ...c, percent: c.total ? Math.round((c.completed / c.total) * 100) : 0 });

/** Counts for a list of tasks already in memory ({ type, status }). */
export function countTasks(tasks) {
  const c = emptyCounts();
  for (const t of tasks) add(c, t.type, t.status, 1);
  return withPercent(c);
}

/**
 * Counts grouped by `key` ("project" | "content") over tasks matching `match`.
 * @returns {Promise<Map<string, object>>} id string → counts (missing id = emptyCounts())
 */
async function countsBy(key, match) {
  const rows = await Task.aggregate([
    { $match: match },
    { $group: { _id: { k: `$${key}`, type: "$type", status: "$status" }, n: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const { _id, n } of rows) {
    const id = _id.k.toString();
    if (!map.has(id)) map.set(id, emptyCounts());
    add(map.get(id), _id.type, _id.status, n);
  }
  for (const [id, c] of map) map.set(id, withPercent(c));
  return map;
}

const oid = (id) => new mongoose.Types.ObjectId(id.toString());

/** Map projectId → counts, for many projects at once (the projects list). */
export const projectsTaskCounts = (projectIds) =>
  projectIds.length ? countsBy("project", { project: { $in: projectIds.map(oid) } }) : Promise.resolve(new Map());

/** Map contentId → counts for every content item of one project (the Content tab). */
export const contentTaskCountsForProject = (projectId) => countsBy("content", { project: oid(projectId) });

export async function projectTaskCounts(projectId) {
  return (await projectsTaskCounts([projectId])).get(projectId.toString()) ?? emptyCounts();
}

export async function contentTaskCounts(projectId, contentId) {
  const map = await countsBy("content", { project: oid(projectId), content: oid(contentId) });
  return map.get(contentId.toString()) ?? emptyCounts();
}

/** Project card / header / Overview numbers. Files are not tracked yet (0). */
export function projectStats(counts = emptyCounts()) {
  return {
    progress: counts.percent,
    files: 0,
    tasks: { total: counts.total, completed: counts.completed, inProgress: counts.inProgress, open: counts.open },
  };
}

/** Per content item: counts + up to 3 recent tasks (shaped for <TaskCard>). */
export function contentStats(counts = emptyCounts(), recentTasks = []) {
  return { ...counts, recentTasks };
}

/**
 * THE roll-up writer. Call after every task create / status change / delete and
 * after a content delete. Re-derives and persists:
 *   - Content.status of `contentId` (when given and still present),
 *   - Project.status of `projectId`, EXCEPT a cancelled project: the filter
 *     `status: { $ne: "cancelled" }` makes that atomic, so a recompute can never
 *     overwrite a manual cancel (Reopen re-derives instead).
 * Neither write bumps updatedAt (list ordering), matching the counter writes.
 */
export async function recomputeRollups({ projectId, contentId }) {
  const [projectCounts, contentCounts] = await Promise.all([
    projectTaskCounts(projectId),
    contentId ? contentTaskCounts(projectId, contentId) : null,
  ]);

  await Promise.all([
    contentId
      ? Content.updateOne(
          { _id: contentId, project: projectId },
          { $set: { status: deriveContentStatus(null, contentCounts) } },
          NO_TIMESTAMPS
        )
      : null,
    Project.updateOne(
      { _id: projectId, status: { $ne: "cancelled" } },
      { $set: { status: deriveStatusFromCounts(projectCounts) } },
      NO_TIMESTAMPS
    ),
  ]);
}
