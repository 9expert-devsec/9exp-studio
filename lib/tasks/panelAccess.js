// Task Detail read access — the pure decision (no DB), shared by the server
// (lib/projects/access.js taskReadAccess) and node checks.
//
//   "full"      the viewer can see the task's own project (admin / owner / member)
//   "read_only" they can't, BUT the task is a Related Asset type (Clip / Graphic /
//               Photo / Article) and at least one Post or Article that links it
//               lives in a project the viewer CAN see (round 34 ruling)
//   "none"      anything else → "Task not found"
// Read-only never grants a write: every action keeps its own permission check.

import { ASSET_TASK_TYPE_KEYS } from "./types.js";

const LINKING_TYPES = ["post", "article"];

/**
 * @param {{ canViewOwnProject: boolean, taskType: string,
 *           linkedFrom: { type: string, projectVisible: boolean }[] }} input
 *   linkedFrom: the tasks whose details.relatedAssets include this task
 * @returns {"full" | "read_only" | "none"}
 */
export function decideTaskPanelAccess({ canViewOwnProject, taskType, linkedFrom = [] }) {
  if (canViewOwnProject) return "full";
  if (!ASSET_TASK_TYPE_KEYS.includes(taskType)) return "none";
  const visibleLink = linkedFrom.some((l) => LINKING_TYPES.includes(l.type) && l.projectVisible);
  return visibleLink ? "read_only" : "none";
}
