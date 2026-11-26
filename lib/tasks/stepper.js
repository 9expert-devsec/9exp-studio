// Task Detail "Status & Progress" stepper — pure (no DB), shared by the server
// read model and node checks.
//
// Steps = the type's statuses in catalog order (lib/tasks/types.js), EXCEPT
// terminal stop states, which are never drawn as steps:
//   - group "cancelled"  → banner "Cancelled"
//   - `hold: true`       → banner "On hold" (graphic "paused")
// Step states: "complete" (before the current), "current", "upcoming"; when the
// task is in a terminal state every step is "muted".
//
// Round 45: a type may group its statuses into fewer drawn steps (catalog
// `stepGroups`, e.g. Clip: waiting_review + revising share "ตรวจงาน"). A status in
// a group's `warn` list makes that step "warning" (with the group's `warnNote`)
// instead of "current". With a grouping, a completed-group status marks EVERY
// step complete (frame 341:2913). Types without a grouping keep the per-status
// behaviour above.
//
// Progress %: there is no per-task progress mapping elsewhere (roll-ups count
// completed tasks), so it is the current step's position: first step 0%, a
// completed-group status 100%, evenly spaced between. Terminal → null ("—").

import { canonicalStatus, findStatus, taskStatuses, taskStepGroups } from "./types.js";

const isTerminal = (s) => s.group === "cancelled" || !!s.hold;

/** The drawn steps: [{ key, label, statuses: [key], warn: [key], warnNote }]. */
function drawnSteps(type) {
  const groups = taskStepGroups(type);
  if (groups) {
    return groups.map((g) => ({
      key: g.key,
      label: g.label ?? findStatus(type, g.statuses[0])?.label ?? g.key,
      statuses: g.statuses,
      warn: g.warn ?? [],
      warnNote: g.warnNote ?? "",
    }));
  }
  return taskStatuses(type)
    .filter((s) => !isTerminal(s))
    .map((s) => ({ key: s.key, label: s.label, statuses: [s.key], warn: [], warnNote: "" }));
}

/**
 * @param {string} type @param {string} status
 * @returns {{ steps: { key: string, label: string, state: "complete"|"current"|"warning"|"upcoming"|"muted", note?: string }[],
 *             terminal: null | { key: string, label: string, kind: "cancelled"|"on_hold", banner: string },
 *             percent: number | null }}
 */
export function buildStatusStepper(type, storedStatus) {
  const status = canonicalStatus(type, storedStatus); // legacy keys (round 40)
  const grouped = !!taskStepGroups(type);
  const drawn = drawnSteps(type);
  const here = taskStatuses(type).find((s) => s.key === status) ?? null;

  if (here && isTerminal(here)) {
    const kind = here.group === "cancelled" ? "cancelled" : "on_hold";
    return {
      steps: drawn.map((s) => ({ key: s.key, label: s.label, state: "muted" })),
      terminal: { key: here.key, label: here.label, kind, banner: kind === "cancelled" ? "Cancelled" : "On hold" },
      percent: null,
    };
  }

  const i = drawn.findIndex((s) => s.statuses.includes(status));
  const allDone = grouped && here?.group === "completed";
  const steps = drawn.map((s, j) => {
    let state = i < 0 ? "upcoming" : j < i ? "complete" : j === i ? "current" : "upcoming";
    if (allDone) state = "complete";
    else if (state === "current" && s.warn.includes(status)) state = "warning";
    return { key: s.key, label: s.label, state, ...(state === "warning" && s.warnNote ? { note: s.warnNote } : {}) };
  });
  let percent = 0;
  if (here?.group === "completed") percent = 100;
  else if (i > 0 && drawn.length > 1) percent = Math.round((i / (drawn.length - 1)) * 100);
  return { steps, terminal: null, percent };
}
