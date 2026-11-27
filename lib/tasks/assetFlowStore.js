// Article / Post related-asset flow (round 49) — DB side. Server only. Rules are
// pure in lib/tasks/assets.js (assetReadiness, autoAssetMove) — the SAME function
// behind the Post Status Asset.
//
// The System re-check: an Article / Post at รอชิ้นงาน moves to รอเผยแพร่ as soon
// as none of its non-cancelled assets is pending (also when it has none left).
// Never backwards. Called after EVERY status write (any task can be someone's
// asset), after an asset list is edited, and after a task is deleted:
//   recheckAssetDependents(ids)  the Article / Posts that list these tasks (any project)
//   recheckAssetTask(task)       one Article / Post (its asset list changed / Set status… to รอชิ้นงาน)
// Never throws: a failure is logged and the caller's action still succeeds.

import "server-only";
import { recomputeRollups } from "@/lib/projects/progress";
import { logActivity } from "@/lib/tasks/activity";
import { ASSET_FLOW_TYPES, assetReadiness, autoAssetMove } from "@/lib/tasks/assets";
import { canTransition } from "@/lib/tasks/transitions";
import Task from "@/models/Task";

const FLOW_FIELDS = "_id project content type status details.relatedAssets";

/** The linked tasks that still exist ({ type, status, title }), in the stored order. */
export async function loadAssetTasks(ids) {
  const list = (ids ?? []).map(String).filter(Boolean);
  if (!list.length) return [];
  const docs = await Task.find({ _id: { $in: list } }).select("type status title").lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return list.map((id) => byId.get(id)).filter(Boolean);
}

/** Readiness of one Article / Post's assets (lib/tasks/assets.js assetReadiness). */
export const readinessOf = async (task) => assetReadiness(await loadAssetTasks(task?.details?.relatedAssets));

/** One Article / Post at รอชิ้นงาน: move it to รอเผยแพร่ (System) when nothing is pending. */
export async function recheckAssetTask(task) {
  try {
    if (!task || !ASSET_FLOW_TYPES.includes(task.type) || task.status !== "waiting_assets") return false;
    const readiness = await readinessOf(task);
    const to = autoAssetMove(task.status, readiness);
    if (!to || !canTransition(task.type, task.status, to).ok) return false;
    const res = await Task.updateOne({ _id: task._id, status: "waiting_assets" }, { $set: { status: to, updatedBy: null } });
    if (!res.matchedCount) return false;
    await logActivity({
      task: task._id,
      project: task.project,
      actor: null,
      type: "status_changed",
      data: { from: "waiting_assets", to, assets: { total: readiness.total } },
    });
    await recomputeRollups({ projectId: task.project, contentId: task.content });
    return true;
  } catch (err) {
    console.error(`[asset-flow] re-check failed for ${String(task?._id)}: ${err?.message ?? "unknown error"}`);
    return false;
  }
}

/** Every Article / Post at รอชิ้นงาน that lists one of these tasks as an asset, across projects. */
export async function recheckAssetDependents(taskIds) {
  try {
    const ids = (taskIds ?? []).filter(Boolean);
    if (!ids.length) return;
    const dependents = await Task.find({ type: { $in: ASSET_FLOW_TYPES }, status: "waiting_assets", "details.relatedAssets": { $in: ids } })
      .select(FLOW_FIELDS)
      .lean();
    for (const t of dependents) await recheckAssetTask(t);
  } catch (err) {
    console.error(`[asset-flow] dependents re-check failed: ${err?.message ?? "unknown error"}`);
  }
}
