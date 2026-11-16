// List filters live in the URL, derived from searchParams on every render (never
// copied into state). Pure; shared by the server pages and the client toolbars.
//   /projects            ?view=grid|list&status=open,in_progress   (a legacy ?type= is ignored)
//   /projects/[id]       ?q=<search>&status=<one status>           (Content tab)

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

export const hasContentFilters = (f) => !!f.q || !!f.status;

export function contentFiltersQuery({ q, status }) {
  const sp = new URLSearchParams();
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
