// Task status migration plan (round 40) — pure, for scripts/migrate-task-statuses.mjs
// and node checks. Renames come from the catalog's LEGACY_STATUS_ALIASES (photo
// retouched → ready, post revising → drafting). Every other task is untouched;
// tasks whose status is still not in their type's catalog are listed, not changed.

import { LEGACY_STATUS_ALIASES, isValidStatus } from "./types.js";

/**
 * @param {{ _id: unknown, type: string, status: string }[]} tasks
 * @returns {{ before: Record<string, Record<string, number>>,
 *             changes: { id: string, type: string, from: string, to: string }[],
 *             unknown: { id: string, type: string, status: string }[] }}
 */
export function planStatusMigration(tasks) {
  const before = {};
  const changes = [];
  const unknown = [];
  for (const t of tasks ?? []) {
    const type = String(t.type ?? "");
    const status = String(t.status ?? "");
    before[type] ??= {};
    before[type][status] = (before[type][status] ?? 0) + 1;
    const to = LEGACY_STATUS_ALIASES[type]?.[status];
    if (to) changes.push({ id: String(t._id), type, from: status, to });
    else if (!isValidStatus(type, status)) unknown.push({ id: String(t._id), type, status });
  }
  return { before, changes, unknown };
}
