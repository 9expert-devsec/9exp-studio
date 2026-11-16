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
// The children's unique {parent, number} index is the backstop.
// Counter writes never bump the parent's updatedAt (it orders lists).

import "server-only";
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
 * Create a child with the next number. The counter makes duplicates impossible in
 * normal operation; on a unique-index clash (E11000) take the next number.
 * @returns {Promise<object | null>} the created doc, or null (parent gone / no number)
 */
export async function createNumbered(seq, parentId, values, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const number = await nextSeq(seq, parentId);
    if (!number) return null;
    try {
      return await seq.Child.create({ ...values, number });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  return null;
}
