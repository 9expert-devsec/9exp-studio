// Auto source-ready (round 45) — the DB side. Server only. The rule is pure in
// lib/tasks/clipFlow.js (sourceReadyMoves, which goes through
// lib/tasks/transitions.js canTransition); this file reads the clips, writes the
// moves and logs them.
//
// Called by the task actions:
//   - a Production moved to เสร็จสมบูรณ์ → every linked Clip at รอ Source
//   - a Clip created / duplicated / edited to link a Production that is ALREADY
//     done → that clip (when it is at รอ Source)
// A system move: no user permission check, actor = System (TaskActivity.actor
// null), `data.auto` names the Production. Each write is filtered on the clip's
// current status, so a concurrent change wins and nothing moves backwards.

import "server-only";
import { recomputeRollups } from "@/lib/projects/progress";
import { logActivity } from "@/lib/tasks/activity";
import { SOURCE_FROM, sourceReadyMoves } from "@/lib/tasks/clipFlow";
import { nextHoldMemory } from "@/lib/tasks/transitions";
import Task from "@/models/Task";

const CLIP_FIELDS = "_id project content type status statusBeforeHold details.relatedProductionId";

/**
 * Move the Clips linked to `production` (in its NEW state) from รอ Source to
 * รอตัดต่อ. `clipIds` limits it to those clips (create / edit of one clip).
 * Never throws: a failure is logged and the caller's action still succeeds.
 * @param {{ _id: unknown, project: unknown, type: string, status: string, title: string }} production
 * @param {{ clipIds?: unknown[] }} [opts]
 * @returns {Promise<number>} clips moved
 */
export async function applySourceReady(production, { clipIds = null } = {}) {
  try {
    if (production?.type !== "production") return 0;
    const clips = await Task.find({
      project: production.project,
      type: "clip",
      status: SOURCE_FROM,
      "details.relatedProductionId": production._id,
      ...(clipIds ? { _id: { $in: clipIds } } : {}),
    })
      .select(CLIP_FIELDS)
      .lean();
    const moves = sourceReadyMoves({ id: production._id, type: production.type, status: production.status }, clips);
    if (!moves.length) return 0;

    const byId = new Map(clips.map((c) => [String(c._id), c]));
    const moved = [];
    for (const m of moves) {
      const clip = byId.get(m.id);
      const res = await Task.updateOne(
        { _id: clip._id, project: clip.project, status: m.from },
        {
          $set: {
            status: m.to,
            statusBeforeHold: nextHoldMemory("clip", m.from, m.to, clip.statusBeforeHold ?? null),
            updatedBy: null, // System
          },
        }
      );
      if (res.matchedCount) moved.push(clip);
    }
    await logActivity(
      moved.map((clip) => ({
        task: clip._id,
        project: clip.project,
        actor: null,
        type: "status_changed",
        data: {
          from: SOURCE_FROM,
          to: moves.find((m) => m.id === String(clip._id)).to,
          auto: { productionId: production._id, productionTitle: production.title },
        },
      }))
    );
    const contents = [...new Set(moved.map((c) => String(c.content)))];
    await Promise.all(contents.map((contentId) => recomputeRollups({ projectId: production.project, contentId })));
    return moved.length;
  } catch (err) {
    console.error(`[source-ready] failed for production ${String(production?._id)}: ${err?.message ?? "unknown error"}`);
    return 0;
  }
}

/** A Clip that links a Production: run the rule for that one clip (create / duplicate / edit). */
export async function applySourceReadyForClip(clip) {
  const pid = clip?.details?.relatedProductionId;
  if (clip?.type !== "clip" || !pid) return 0;
  const production = await Task.findOne({ _id: pid, project: clip.project, type: "production" })
    .select("_id project type status title")
    .lean();
  if (!production) return 0;
  return applySourceReady(production, { clipIds: [clip._id] });
}
