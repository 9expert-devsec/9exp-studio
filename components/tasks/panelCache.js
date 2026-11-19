// Client-side Task Detail cache (browser memory only; never persisted). Re-opening
// a task shows its last data at once while the host refreshes it in the background.
// Writes that change a task (status, edit, duplicate, delete) call
// invalidateTaskPanel() — all entries, since a Post's derived asset status can
// change with its assets — and an open panel refetches (keeping its data meanwhile).

const MAX_ENTRIES = 30;
const entries = new Map(); // taskId → panel | null (null = not found)
let version = 0;
const listeners = new Set();

export const getCachedPanel = (taskId) => (entries.has(taskId) ? { panel: entries.get(taskId) } : null);

export function setCachedPanel(taskId, panel) {
  entries.delete(taskId);
  entries.set(taskId, panel);
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
}

/** Drop one task (or, without an id, every task) and tell an open panel to refetch. */
export function invalidateTaskPanel(taskId) {
  if (taskId) entries.delete(String(taskId));
  else entries.clear();
  version += 1;
  for (const l of listeners) l();
}

// useSyncExternalStore plumbing (the host refetches when the version changes).
export function subscribePanelCache(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const panelCacheVersion = () => version;
