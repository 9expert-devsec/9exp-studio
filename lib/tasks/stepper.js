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
// Progress %: there is no per-task progress mapping elsewhere (roll-ups count
// completed tasks), so it is the current step's position: first step 0%, a
// completed-group status 100%, evenly spaced between. Terminal → null ("—").

import { taskStatuses } from "./types.js";

const isTerminal = (s) => s.group === "cancelled" || !!s.hold;

/**
 * @param {string} type @param {string} status
 * @returns {{ steps: { key: string, label: string, state: "complete"|"current"|"upcoming"|"muted" }[],
 *             terminal: null | { key: string, label: string, kind: "cancelled"|"on_hold", banner: string },
 *             percent: number | null }}
 */
export function buildStatusStepper(type, status) {
  const all = taskStatuses(type);
  const drawn = all.filter((s) => !isTerminal(s));
  const here = all.find((s) => s.key === status) ?? null;

  if (here && isTerminal(here)) {
    const kind = here.group === "cancelled" ? "cancelled" : "on_hold";
    return {
      steps: drawn.map((s) => ({ key: s.key, label: s.label, state: "muted" })),
      terminal: { key: here.key, label: here.label, kind, banner: kind === "cancelled" ? "Cancelled" : "On hold" },
      percent: null,
    };
  }

  const i = drawn.findIndex((s) => s.key === status);
  const steps = drawn.map((s, j) => ({
    key: s.key,
    label: s.label,
    state: i < 0 ? "upcoming" : j < i ? "complete" : j === i ? "current" : "upcoming",
  }));
  let percent = 0;
  if (here?.group === "completed") percent = 100;
  else if (i > 0 && drawn.length > 1) percent = Math.round((i / (drawn.length - 1)) * 100);
  return { steps, terminal: null, percent };
}
