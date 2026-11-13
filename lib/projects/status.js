// Project status: presentation map + transitions, in ONE place.
//
// Status is "auto" by design: a later round derives open → in_progress (first task
// started) → completed (all tasks done) from Tasks. Tasks don't exist yet, so new
// projects are "open" and the only manual transitions are Cancel and Reopen.
// The Task round plugs its logic into deriveAutoStatus().

// Token-based classes only (no new colours needed): open = neutral, in_progress =
// brand orange, completed = success, cancelled = danger.
export const PROJECT_STATUS = {
  open: { label: "Open", dot: "bg-fg-muted", chip: "bg-track text-fg-muted" },
  in_progress: { label: "In progress", dot: "bg-brand-500", chip: "bg-accent-soft text-accent-fg" },
  completed: { label: "Completed", dot: "bg-success", chip: "bg-success/15 text-success" },
  cancelled: { label: "Cancelled", dot: "bg-danger", chip: "bg-danger/15 text-danger" },
};

export function statusInfo(status) {
  return PROJECT_STATUS[status] ?? PROJECT_STATUS.open;
}

/**
 * PLACEHOLDER for the Task round: derive the automatic status from task stats.
 * Cancelled always wins (manual). Until Tasks exist this returns the stored status.
 * @param {{ status: string }} project
 * @param {{ total: number, completed: number, inProgress: number, open: number }} _taskStats
 */
export function deriveAutoStatus(project, _taskStats) {
  if (project.status === "cancelled") return "cancelled";
  // Future: if total > 0 && completed === total → "completed";
  //         else if inProgress > 0 || completed > 0 → "in_progress"; else "open".
  return project.status ?? "open";
}

export const canCancelStatus = (status) => status !== "cancelled";
export const canReopenStatus = (status) => status === "cancelled";

/** Status a cancelled project returns to on Reopen (re-derived once Tasks exist). */
export function reopenedStatus(project, taskStats) {
  return deriveAutoStatus({ ...project, status: "open" }, taskStats);
}
