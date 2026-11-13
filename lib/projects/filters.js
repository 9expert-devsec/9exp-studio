// List filters live in the URL: ?view=grid|list&status=open,in_progress&type=ongoing|campaign
// Derived from searchParams on every render (never copied into state). Pure; shared
// by the server page and the client toolbar.

import { PROJECT_STATUSES, PROJECT_TYPES } from "./rules";

const first = (v) => (Array.isArray(v) ? v[0] : v);

/** @param {Record<string, string | string[] | undefined>} params */
export function parseProjectFilters(params = {}) {
  const view = first(params.view) === "list" ? "list" : "grid";
  const statuses = String(first(params.status) ?? "")
    .split(",")
    .filter((s) => PROJECT_STATUSES.includes(s));
  const typeRaw = first(params.type);
  const type = PROJECT_TYPES.includes(typeRaw) ? typeRaw : "";
  return { view, statuses: [...new Set(statuses)], type };
}

export const hasActiveFilters = (f) => f.statuses.length > 0 || !!f.type;

/** Query string for a filter state (defaults omitted). */
export function projectFiltersQuery({ view, statuses, type }) {
  const q = new URLSearchParams();
  if (view === "list") q.set("view", "list");
  if (statuses?.length) q.set("status", statuses.join(","));
  if (type) q.set("type", type);
  const s = q.toString();
  return s ? `?${s}` : "";
}
