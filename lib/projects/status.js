// Project / content status: presentation map + derivation, in ONE place.
//
// Status is automatic, derived from task counts by GROUP (lib/tasks/types.js):
//   no non-cancelled tasks                    → open
//   all non-cancelled tasks completed (≥ 1)   → completed
//   any in_progress or completed              → in_progress
//   otherwise                                 → open
// A project's "cancelled" is manual and always wins (Reopen re-derives). The derived
// value is also persisted by recomputeRollups() (lib/projects/progress.js) after
// every task write, so stored statuses stay in step.

// Token-based classes only (no new colours needed): open = neutral, in_progress =
// brand orange, completed = success, cancelled = danger. Shared by projects, content
// and task status GROUPS: `text` is the plain status-coloured label.
export const PROJECT_STATUS = {
  open: { label: "Open", dot: "bg-fg-muted", chip: "bg-track text-fg-muted", text: "text-fg-muted" },
  in_progress: { label: "In progress", dot: "bg-brand-500", chip: "bg-accent-soft text-accent-fg", text: "text-accent-fg" },
  completed: { label: "Completed", dot: "bg-success", chip: "bg-success/15 text-success", text: "text-success" },
  cancelled: { label: "Cancelled", dot: "bg-danger", chip: "bg-danger/15 text-danger", text: "text-danger" },
};

export function statusInfo(status) {
  return PROJECT_STATUS[status] ?? PROJECT_STATUS.open;
}

/**
 * @param {{ total: number, completed: number, inProgress: number }} counts
 *   total = tasks NOT cancelled (lib/projects/progress.js).
 */
export function deriveStatusFromCounts(counts) {
  if (!counts || counts.total === 0) return "open";
  if (counts.completed === counts.total) return "completed";
  if (counts.inProgress > 0 || counts.completed > 0) return "in_progress";
  return "open";
}

/** A project's status: cancelled (manual) wins, else derived from its task counts. */
export function deriveAutoStatus(project, counts) {
  if (project.status === "cancelled") return "cancelled";
  return deriveStatusFromCounts(counts);
}

/** A content item's status: always derived from its own task counts. */
export function deriveContentStatus(_content, counts) {
  return deriveStatusFromCounts(counts);
}

export const canCancelStatus = (status) => status !== "cancelled";
export const canReopenStatus = (status) => status === "cancelled";

/** Status a cancelled project returns to on Reopen: re-derived from its tasks. */
export function reopenedStatus(counts) {
  return deriveStatusFromCounts(counts);
}
