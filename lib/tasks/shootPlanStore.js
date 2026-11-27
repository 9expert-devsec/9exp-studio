// Production shoot sessions → linked Work Plan plans (round 57.1). Server only.
// Called by the task saves (task-actions.js create / edit / the นัดถ่าย dialog) in
// the same request, after the task is written. Rules: lib/tasks/shootSessions.js
// (desiredShootPlans, diffShootPlans). Touches ONLY plans with
// source = "shootSession" of this task; hand-made plans are never read or written.
// Linked plans skip the cross-task overlap check: they mirror the real shoot.

import "server-only";
import { SHOOT_PLAN_SOURCE, desiredShootPlans, diffShootPlans } from "@/lib/tasks/shootSessions";
import TaskWorkEntry from "@/models/TaskWorkEntry";

/**
 * Make the task's linked plans match its sessions × Studio people.
 * @param {{ _id: unknown, project: unknown, type: string, details: object }} task  the task AS SAVED
 * @param {unknown} actorId
 * @returns {Promise<{ inserted: number, updated: number, removed: number }>}
 */
export async function syncShootPlans(task, actorId) {
  const desired = task.type === "production" ? desiredShootPlans(task.details) : [];
  const docs = await TaskWorkEntry.find({ task: task._id, kind: "plan", source: SHOOT_PLAN_SOURCE }).lean();
  const existing = docs.map((d) => ({ ...d, id: String(d._id) }));
  const { insert, update, remove } = diffShootPlans(desired, existing);
  if (remove.length) await TaskWorkEntry.deleteMany({ _id: { $in: remove }, task: task._id, source: SHOOT_PLAN_SOURCE });
  for (const u of update) {
    await TaskWorkEntry.updateOne({ _id: u.id, task: task._id, source: SHOOT_PLAN_SOURCE }, { $set: { ...u.set, updatedBy: actorId } });
  }
  if (insert.length) {
    await TaskWorkEntry.insertMany(
      insert.map((p) => ({
        task: task._id,
        project: task.project,
        person: p.person,
        kind: "plan",
        date: p.date,
        mode: "range",
        start: p.start,
        end: p.end,
        minutes: p.minutes,
        source: SHOOT_PLAN_SOURCE,
        sessionId: p.sessionId,
        sessionPart: p.part,
        createdBy: actorId,
      }))
    );
  }
  return { inserted: insert.length, updated: update.length, removed: remove.length };
}
