// Manual display order (drag to reorder) — pure helpers, no DB. Shared by the
// server (queries, actions) and node checks.
//
// Content cards within a project and task cards within one content carry an
// optional `sortOrder`. Rule:
//   - Never reordered yet (no sortOrder anywhere): order = number (01, 02, …).
//   - The first reorder (or a duplicate) writes sortOrder 1..n for EVERY item in
//     that container; new items then get max + 1 (appended).
//   - Key = sortOrder ?? number, ties by number, so a mixed state (shouldn't
//     happen) still has a stable, sensible order.
// Numbers (content 01…, TASK 01…) never change; only the display order does.

const key = (item) => (Number.isFinite(item?.sortOrder) ? item.sortOrder : item?.number ?? 0);

/** Comparator for docs/views with { sortOrder?, number }. */
export function compareByOrder(a, b) {
  return key(a) - key(b) || (a?.number ?? 0) - (b?.number ?? 0);
}

/** A sorted copy. */
export const sortByOrder = (items) => [...items].sort(compareByOrder);

/** Does this container already use sortOrder (i.e. was it ever reordered)? */
export const hasManualOrder = (items) => items.some((i) => Number.isFinite(i?.sortOrder));

/**
 * The posted order must be EXACTLY the container's current items: same set, no
 * duplicates, no strays, none missing.
 * @param {string[]} currentIds the container's item ids (server truth)
 * @param {unknown} orderedIds  what the client posted
 * @returns {{ ok: true, ids: string[] } | { ok: false, error: string }}
 */
export function validateReorder(currentIds, orderedIds) {
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === "string")) {
    return { ok: false, error: "invalid list" };
  }
  const current = new Set(currentIds.map(String));
  const posted = new Set(orderedIds);
  if (posted.size !== orderedIds.length) return { ok: false, error: "duplicate ids" };
  if (orderedIds.some((id) => !current.has(id))) return { ok: false, error: "unknown ids" };
  if (posted.size !== current.size) return { ok: false, error: "missing ids" };
  return { ok: true, ids: [...orderedIds] };
}

/** `ids` with `newId` moved/inserted right after `afterId` (appended if afterId is absent). */
export function insertAfter(ids, afterId, newId) {
  const rest = ids.filter((id) => id !== newId);
  const i = rest.indexOf(afterId);
  if (i < 0) return [...rest, newId];
  return [...rest.slice(0, i + 1), newId, ...rest.slice(i + 1)];
}

/** bulkWrite ops writing sortOrder 1..n in this order (scope = extra filter, e.g. { project }). */
export const orderWrites = (ids, scope = {}) =>
  ids.map((id, i) => ({ updateOne: { filter: { _id: id, ...scope }, update: { $set: { sortOrder: i + 1 } } } }));

/** sortOrder for a NEW item appended to a container: max + 1, or undefined while it has none. */
export function appendedSortOrder(items) {
  const orders = items.map((i) => i?.sortOrder).filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 1 : undefined;
}
