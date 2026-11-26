// Which task status may follow which (round 40) — THE single source of truth.
// Pure (no DB, no React): shared by the status-change server action, the read
// models (the menu's choices) and node checks. Statuses come from the catalog
// (lib/tasks/types.js); stored legacy keys are resolved first (canonicalStatus).
//
// 1. Forward arrows: per type, from the flow diagrams (NEXT below).
//    Conditional: → waiting_assets (post / article "รอชิ้นงาน") is offered only
//    when the task has at least one Related Asset (details.relatedAssets).
// 2. Escape hatches, computed for every type:
//    back     one step back. Rule: among the statuses with a forward arrow INTO
//             the current one that come EARLIER in catalog order (so loop edges
//             like revising → waiting_review don't count), the latest one;
//             waiting_assets is skipped when the task has no related assets. Not
//             offered when it equals a forward arrow (revising ⇄ waiting_review).
//    pause    types with a `hold` status (clip, graphic): from any status that
//             is not cancelled / completed / hold.
//    resume   from hold → `statusBeforeHold` (the status it was paused from).
//    cancel   from any status except completed-group ones (and cancelled).
//    reopen   from cancelled → `statusBeforeHold`; from a completed status → one
//             step back (same rule as "back", e.g. เสร็จสมบูรณ์ → รอตรวจ).
//    override superadmin / project owner (lib/permissions.js canOverrideTaskStatus):
//             any other status of the type.
// `statusBeforeHold` (Task.statusBeforeHold) = the working status a task left
// when it entered hold or cancelled (nextHoldMemory). Missing / no longer valid
// (old data) → resume / reopen go to the type's INITIAL status.

import { canonicalStatus, findStatus, getTaskType, initialStatus, isValidStatus, taskStatuses } from "./types.js";

const arrows = (...pairs) => {
  const map = {};
  for (const [from, to] of pairs) (map[from] ??= []).push(to);
  return map;
};

const NEXT = {
  production: arrows(["not_started", "scheduled"], ["scheduled", "shot"], ["shot", "done"]),
  // The two-part review (Present / Video) arrives in round 41; until then the
  // reviewer picks แก้ไข or เสร็จสมบูรณ์ by hand.
  clip: arrows(
    ["waiting_source", "waiting_edit"],
    ["waiting_edit", "editing"],
    ["editing", "waiting_review"],
    ["waiting_review", "revising"],
    ["waiting_review", "done"],
    ["revising", "waiting_review"]
  ),
  graphic: arrows(
    ["not_started", "in_progress"],
    ["in_progress", "waiting_review"],
    ["waiting_review", "revising"],
    ["waiting_review", "done"],
    ["revising", "waiting_review"]
  ),
  post: arrows(["drafting", "waiting_assets"], ["drafting", "scheduled"], ["waiting_assets", "scheduled"], ["scheduled", "published"]),
  article: arrows(
    ["not_started", "drafting"],
    ["drafting", "waiting_assets"],
    ["drafting", "scheduled"],
    ["waiting_assets", "scheduled"],
    ["scheduled", "published"]
  ),
  photo: arrows(["not_started", "shot"], ["shot", "filed"], ["filed", "retouching"], ["retouching", "ready"]),
};

/** Forward arrows of a type ({ from: [to] }); {} when unknown. */
export const forwardArrows = (type) => NEXT[type] ?? {};

const NEEDS_ASSETS = "waiting_assets";

const isCancelled = (s) => s?.group === "cancelled";
const isCompleted = (s) => s?.group === "completed";
const isHold = (s) => !!s?.hold;
/** A working status: not hold, not cancelled (completed counts as working here). */
const isWorking = (s) => !!s && !isHold(s) && !isCancelled(s);

const holdKey = (type) => taskStatuses(type).find(isHold)?.key ?? null;
const cancelKey = (type) => taskStatuses(type).find(isCancelled)?.key ?? null;

/** One step back from `current` (rule in the header), or null. */
function backTarget(type, current, hasRelatedAssets) {
  const all = taskStatuses(type);
  const index = (k) => all.findIndex((s) => s.key === k);
  const here = index(current);
  const preds = Object.entries(forwardArrows(type))
    .filter(([from, tos]) => tos.includes(current) && index(from) < here)
    .map(([from]) => from)
    .filter((k) => hasRelatedAssets || k !== NEEDS_ASSETS)
    .sort((a, b) => index(b) - index(a));
  return preds[0] ?? null;
}

/** Where resume / reopen-from-cancelled go: statusBeforeHold if still a working status, else initial. */
function returnTarget(type, statusBeforeHold) {
  const s = statusBeforeHold ? findStatus(type, statusBeforeHold) : null;
  return isWorking(s) ? s.key : initialStatus(type);
}

/**
 * The statuses a task may move to from `current`, in menu order: forward, then
 * back / pause / resume / reopen, then cancel, then override (the rest).
 * @param {string} type @param {string} current  stored status (legacy keys ok)
 * @param {{ canOverride?: boolean, hasRelatedAssets?: boolean, statusBeforeHold?: string|null, noForwardFrom?: string|null }} [opts]
 * @returns {{ key: string, label: string, group: string, kind: "forward"|"back"|"pause"|"resume"|"cancel"|"reopen"|"override" }[]}
 */
export function allowedNextStatuses(
  type,
  current,
  { canOverride = false, hasRelatedAssets = false, statusBeforeHold = null, noForwardFrom = null } = {}
) {
  if (!getTaskType(type)) return [];
  const here = findStatus(type, current);
  const key = canonicalStatus(type, current);
  const out = [];
  const add = (k, kind) => {
    const s = findStatus(type, k);
    if (!s || s.key === key || out.some((o) => o.key === s.key)) return;
    out.push({ key: s.key, label: s.label, group: s.group, kind });
  };

  if (here) {
    if (isWorking(here) && !isCompleted(here)) {
      // `noForwardFrom` (round 46): a review status whose way forward is decided by
      // the verdicts (lib/tasks/reviews.js), never picked by hand.
      if (key !== noForwardFrom) {
        for (const to of forwardArrows(type)[key] ?? []) if (to !== NEEDS_ASSETS || hasRelatedAssets) add(to, "forward");
      }
      add(backTarget(type, key, hasRelatedAssets), "back");
      add(holdKey(type), "pause");
    }
    if (isCompleted(here)) add(backTarget(type, key, hasRelatedAssets), "reopen");
    if (isHold(here)) add(returnTarget(type, statusBeforeHold), "resume");
    if (isCancelled(here)) add(returnTarget(type, statusBeforeHold), "reopen");
    if (!isCompleted(here) && !isCancelled(here)) add(cancelKey(type), "cancel");
  }
  // Unknown stored status (bad data): only an override can fix it.
  if (canOverride) for (const s of taskStatuses(type)) add(s.key, "override");
  return out;
}

/**
 * May a task move from `from` to `to`?
 * @returns {{ ok: true, kind: string } | { ok: false, reason: string }}
 */
export function canTransition(type, from, to, opts = {}) {
  if (!isValidStatus(type, to)) return { ok: false, reason: "Choose a status for this task type." };
  if (canonicalStatus(type, from) === to) return { ok: false, reason: "The task already has this status." };
  const move = allowedNextStatuses(type, from, opts).find((m) => m.key === to);
  if (!move) {
    return {
      ok: false,
      reason: `This task can't move from “${findStatus(type, from)?.label ?? from}” to “${findStatus(type, to)?.label ?? to}”. Choose one of the statuses offered.`,
    };
  }
  return { ok: true, kind: move.kind };
}

/**
 * New Task.statusBeforeHold after a move: entering hold / cancelled remembers the
 * working status it left (a move between hold and cancelled keeps the earlier
 * memory); any other move clears it (null).
 */
export function nextHoldMemory(type, from, to, current = null) {
  const target = findStatus(type, to);
  if (!isHold(target) && !isCancelled(target)) return null;
  const left = findStatus(type, from);
  return isWorking(left) ? left.key : (current ?? null);
}

/** Does a task count as having related assets (post / article details.relatedAssets)? */
export const taskHasRelatedAssets = (task) => Array.isArray(task?.details?.relatedAssets) && task.details.relatedAssets.length > 0;
