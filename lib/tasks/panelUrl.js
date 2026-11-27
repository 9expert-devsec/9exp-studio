// Task Detail panel URL + response helpers (pure; shared by the client host and the
// node checks). The panel's open state is `?task=<id>` in the URL and nothing else.

const TASK_ID = /^[a-f0-9]{24}$/i;

/** A valid task id, or "" (a malformed ?task= still opens the panel as "not found"). */
export const validTaskId = (v) => (TASK_ID.test(String(v ?? "")) ? String(v) : "");

/**
 * `search` ("?a=1&task=…" or "a=1") with some params set / removed, every other
 * param kept in its place. A null / "" / false value removes the key.
 * Returns "" or "?…" (ready to append to a pathname).
 * @param {string} search @param {Record<string, string | null | false | undefined>} changes
 */
export function withSearchParams(search, changes) {
  const sp = new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
  for (const [key, value] of Object.entries(changes)) {
    if (value == null || value === "" || value === false) sp.delete(key);
    else sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * The URL (pathname + search + hash) that opens / closes (taskId "") the panel.
 * Round 58: `tab` ("work_plan") = the panel's starting tab (?taskTab=); closing drops it.
 */
export const taskPanelUrl = ({ pathname, search, hash = "" }, taskId, tab = "") =>
  `${pathname}${withSearchParams(search, { task: taskId || null, taskTab: (taskId && tab) || null })}${hash}`;

/**
 * Stale-response guard: each request takes a token from `begin()`; only the latest
 * token is current. `cancel()` makes every in-flight token stale (panel closed /
 * effect cleaned up), so a slow answer for an old id can never win.
 */
export function createLatestGuard() {
  let latest = 0;
  return {
    begin: () => ++latest,
    isCurrent: (token) => token === latest,
    cancel: () => {
      latest += 1;
    },
  };
}
