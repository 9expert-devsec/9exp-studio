// Atomic per-parent sequence numbers, shared by content (Project.contentSeq →
// Content.number) and tasks (Content.taskSeq → Task.number). Server only.
//
// A number is never reused, even after deletes:
//   - When the parent's counter field is missing (documents from before the
//     counter), it is set ONCE to the children's current max number. The write is
//     conditional on the field still being missing, so concurrent initialisers
//     can't overwrite a live counter.
//   - Each new number is one atomic $inc.
//   - Delete actions call ensureSeq() BEFORE deleting, so a legacy parent's
//     highest number is recorded first.
// The children's unique {parent, number} index is the backstop; a clash on it
// heals the counter (createNumbered). Repair: scripts/repair-task-counters.mjs.
// Counter writes never bump the parent's updatedAt (it orders lists).

import "server-only";
import { counterTarget, DuplicateKeyError, duplicateKeyKind } from "@/lib/projects/dupKey";
import Content from "@/models/Content";
import Project from "@/models/Project";
import Task from "@/models/Task";

const NO_TIMESTAMPS = { timestamps: false };

/** counter = field on Parent; children are Child docs whose `childKey` points at the parent. */
export const CONTENT_SEQ = { Parent: Project, field: "contentSeq", Child: Content, childKey: "project" };
export const TASK_SEQ = { Parent: Content, field: "taskSeq", Child: Task, childKey: "content" };

export async function ensureSeq({ Parent, field, Child, childKey }, parentId) {
  if (await Parent.exists({ _id: parentId, [field]: { $exists: true } })) return;
  const last = await Child.findOne({ [childKey]: parentId }).sort({ number: -1 }).select("number").lean();
  await Parent.updateOne(
    { _id: parentId, [field]: { $exists: false } },
    { $set: { [field]: last?.number ?? 0 } },
    NO_TIMESTAMPS
  );
}

/** The next number for this parent, or null when the parent no longer exists. */
export async function nextSeq(seq, parentId) {
  await ensureSeq(seq, parentId);
  const updated = await seq.Parent.findOneAndUpdate(
    { _id: parentId },
    { $inc: { [seq.field]: 1 } },
    { returnDocument: "after", projection: { [seq.field]: 1 }, ...NO_TIMESTAMPS }
  ).lean();
  return updated?.[seq.field] ?? null;
}

/**
 * Self-heal a counter that fell behind: atomically raise it to at least the
 * children's highest number ($max never lowers it), so the next $inc is free.
 */
export async function healSeq({ Parent, field, Child, childKey }, parentId) {
  const last = await Child.findOne({ [childKey]: parentId }).sort({ number: -1 }).select("number").lean();
  await Parent.updateOne({ _id: parentId }, { $max: { [field]: counterTarget(0, last?.number) } }, NO_TIMESTAMPS);
}

/**
 * Create a child with the next number. The counter makes duplicates impossible in
 * normal operation. Round 39:
 *   - E11000 on the {parent, number} index → the counter drifted: heal it to the
 *     highest existing number and retry (bounded).
 *   - E11000 on ANY other unique index → not a numbering problem: logged with its
 *     keyPattern / keyValue and thrown as DuplicateKeyError (no retry, no more
 *     numbers burned).
 * @returns {Promise<object | null>} the created doc, or null (parent gone / still clashing)
 */
export async function createNumbered(seq, parentId, values, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    const number = await nextSeq(seq, parentId);
    if (!number) return null;
    try {
      return await seq.Child.create({ ...values, number });
    } catch (err) {
      const kind = duplicateKeyKind(err, seq.childKey);
      if (!kind) throw err;
      if (kind !== "number") throw logDuplicateKey(seq, err, kind);
      console.warn(`[sequence] ${seq.field} clash on number ${number} for ${parentId}; healing counter`);
      await healSeq(seq, parentId);
    }
  }
  return null;
}

/** Server log for a non-numbering duplicate key (no document values beyond the key). */
export function logDuplicateKey(seq, err, kind = duplicateKeyKind(err, seq.childKey)) {
  const e = new DuplicateKeyError(kind, err);
  console.error(`[sequence] ${seq.Child.modelName} duplicate key (${kind})`, { keyPattern: e.keyPattern, keyValue: e.keyValue });
  return e;
}
