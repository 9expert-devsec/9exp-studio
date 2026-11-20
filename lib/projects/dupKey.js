// Duplicate-key (E11000) errors on numbered children (round 39) — pure, so the
// classifier and counter maths are node-checked. Used by lib/projects/sequence.js
// and the task actions.
//
// Only a clash on the {<parent>, number} unique index is a numbering problem
// (the counter fell behind: self-heal and retry). Any OTHER unique index (e.g. a
// stale unique `folderId_1` on tasks left from before shared folders) must never
// be reported as "Could not number…": it is surfaced as its own error.

/** keyPattern of an E11000 error ({} when absent), with a fallback from the message's index name. */
export function duplicateKeyPattern(err) {
  if (err?.keyPattern && typeof err.keyPattern === "object") return err.keyPattern;
  const name = /index: (\S+)/.exec(String(err?.errmsg ?? err?.message ?? ""))?.[1];
  if (!name) return {};
  // "content_1_number_1" → { content: 1, number: 1 }
  const parts = name.split("_");
  const out = {};
  for (let i = 0; i + 1 < parts.length; i += 2) out[parts[i]] = Number(parts[i + 1]);
  return out;
}

/**
 * What a create/update error is, for a child numbered within `childKey`:
 *   null      — not a duplicate-key error
 *   "number"  — the {childKey, number} unique index (numbering clash)
 *   "folder"  — a unique folderId index (stale index from before shared folders)
 *   "other"   — any other unique index
 */
export function duplicateKeyKind(err, childKey) {
  if (err?.code !== 11000) return null;
  const keys = Object.keys(duplicateKeyPattern(err)).sort();
  if (keys.length === 2 && keys.includes(childKey) && keys.includes("number")) return "number";
  if (keys.length === 1 && keys[0] === "folderId") return "folder";
  return "other";
}

/** The counter value that makes the next $inc land above every existing number. */
export const counterTarget = (current, maxExisting) => Math.max(Number(current) || 0, Number(maxExisting) || 0);

/**
 * Repair plan (scripts/repair-task-counters.mjs): parents whose counter is below
 * their children's highest number. A missing counter is left alone (ensureSeq
 * initialises it from the max on first use). Never lowers a counter.
 * @param {{ id: string, counter?: number }[]} parents
 * @param {Map<string, number>} maxByParent  parent id → highest child number
 * @returns {{ id: string, from: number, to: number }[]}
 */
export function planCounterRepairs(parents, maxByParent) {
  const out = [];
  for (const p of parents) {
    if (typeof p.counter !== "number") continue;
    const to = counterTarget(p.counter, maxByParent.get(String(p.id)));
    if (to > p.counter) out.push({ id: String(p.id), from: p.counter, to });
  }
  return out;
}

/** A duplicate-key error that is NOT a numbering clash (kind "folder" | "other"). */
export class DuplicateKeyError extends Error {
  constructor(kind, err) {
    super(`Duplicate key (${kind}): ${JSON.stringify(duplicateKeyPattern(err))}`);
    this.name = "DuplicateKeyError";
    this.kind = kind;
    this.keyPattern = duplicateKeyPattern(err);
    this.keyValue = err?.keyValue ?? null;
  }
}

/** The message a user sees for a non-numbering duplicate key. */
export const duplicateKeyMessage = (kind) =>
  kind === "folder"
    ? "This folder can't be shared yet: the database still allows only one task per Folder ID. Ask an admin to run the task repair script, then try again."
    : "This task clashes with an existing record, so it wasn't saved. Please try again or contact an admin.";
