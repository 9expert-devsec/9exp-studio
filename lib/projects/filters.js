// List filters live in the URL, derived from searchParams on every render (never
// copied into state). Pure; shared by the server pages and the client toolbars.
//   /projects            ?view=grid|list&status=open,in_progress   (a legacy ?type= is ignored)
//   /projects/[id]       ?q=<search>&status=<one status>           (Content tab)
//   /projects/[id]/content/[contentId]   ?q=&status=&sort=&view=    (Tasks section)

import { PROJECT_STATUSES } from "./rules";

const first = (v) => (Array.isArray(v) ? v[0] : v);

/** @param {Record<string, string | string[] | undefined>} params */
export function parseProjectFilters(params = {}) {
  const view = first(params.view) === "list" ? "list" : "grid";
  const statuses = String(first(params.status) ?? "")
    .split(",")
    .filter((s) => PROJECT_STATUSES.includes(s));
  return { view, statuses: [...new Set(statuses)] };
}

export const hasActiveFilters = (f) => f.statuses.length > 0;

/** Query string for a filter state (defaults omitted). */
export function projectFiltersQuery({ view, statuses }) {
  const q = new URLSearchParams();
  if (view === "list") q.set("view", "list");
  if (statuses?.length) q.set("status", statuses.join(","));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const CONTENT_SEARCH_MAX = 100;

/** Content tab: free-text search + a single status. */
export function parseContentFilters(params = {}) {
  const q = String(first(params.q) ?? "").trim().slice(0, CONTENT_SEARCH_MAX);
  const statusRaw = first(params.status);
  const status = PROJECT_STATUSES.includes(statusRaw) ? statusRaw : "";
  return { q, status };
}

/**
 * Content detail → Tasks toolbar: ?q=&status=&sort=due_asc|due_desc&view=cards|table
 * `status` is a status GROUP (open / in_progress / completed / cancelled): raw task
 * statuses differ per type. `newTask=1` opens the Create Task drawer;
 * `editTask=<taskId>` opens it in edit mode.
 */
export const TASK_SORTS = ["due_asc", "due_desc"];
export const TASK_VIEWS = ["cards", "table"];

export function parseTaskFilters(params = {}) {
  const { q, status } = parseContentFilters(params);
  const sort = TASK_SORTS.includes(first(params.sort)) ? first(params.sort) : "due_asc";
  const view = TASK_VIEWS.includes(first(params.view)) ? first(params.view) : "cards";
  const newTask = first(params.newTask) === "1";
  const editRaw = String(first(params.editTask) ?? "");
  const editTask = /^[a-f0-9]{24}$/i.test(editRaw) ? editRaw : "";
  return { q, status, sort, view, newTask, editTask };
}

export const hasTaskFilters = (f) => !!f.q || !!f.status;

/** Query string for a task filter state (defaults omitted). */
export function taskFiltersQuery({ q, status, sort, view, newTask, editTask }) {
  const sp = new URLSearchParams();
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  if (sort && sort !== "due_asc") sp.set("sort", sort);
  if (view && view !== "cards") sp.set("view", view);
  if (newTask) sp.set("newTask", "1");
  else if (editTask) sp.set("editTask", editTask);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const hasContentFilters = (f) => !!f.q || !!f.status;

export function contentFiltersQuery({ q, status }) {
  const sp = new URLSearchParams();
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
