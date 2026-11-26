// Clip workflow rules (round 45) — pure (no DB, no React). Shared by the server
// (details parser, task actions, panel read model) and node checks.
//
// 1. Related Production: a Clip may link ONE Production task of the same project
//    (details.relatedProductionId). relatedProductionError() checks a pick
//    against the stored facts; defaultRelatedProductionId() is the create-time
//    pre-selection (exactly one usable Production in the clip's content).
// 2. Auto source-ready: when a Production is เสร็จสมบูรณ์ (done), every Clip that
//    links it AND is at รอ Source moves to รอตัดต่อ. sourceReadyMoves() decides
//    which clips move; the move itself must be a legal arrow
//    (lib/tasks/transitions.js canTransition). Never moves backwards.
// 3. Primary action: the ONE button of the Task Detail "Current Status" card
//    per Clip status (clipPrimaryAction).

import { canTransition } from "./transitions.js";
import { statusGroup } from "./types.js";

const idStr = (v) => (v ? String(v) : "");

export const SOURCE_FROM = "waiting_source";
export const SOURCE_TO = "waiting_edit";
const PRODUCTION_DONE = "done";

// ── 1. Related Production ─────────────────────────────────────────────────

/**
 * Why a picked Production can't be linked, or null when it can.
 * @param {{ type: string, project: unknown, status: string } | null} doc the picked task (null = missing)
 * @param {{ projectId: unknown, unchanged?: boolean }} ctx `unchanged` = the clip already
 *   stores this link: a Production cancelled AFTER it was chosen stays valid.
 */
export function relatedProductionError(doc, { projectId, unchanged = false }) {
  if (!doc) return "That Production task no longer exists. Choose another.";
  if (doc.type !== "production") return "Choose a Production task.";
  if (idStr(doc.project) !== idStr(projectId)) return "Choose a Production task from this project.";
  if (!unchanged && statusGroup("production", doc.status) === "cancelled") return "That Production task is cancelled. Choose another.";
  return null;
}

/**
 * Create-time pre-selection: the id of the ONLY non-cancelled Production task in
 * the clip's content, else "" (none, or several → never auto-pick).
 * @param {{ id: string, contentId: string, status: string }[]} productions
 */
export function defaultRelatedProductionId(productions, contentId) {
  const usable = (productions ?? []).filter(
    (p) => idStr(p.contentId) === idStr(contentId) && statusGroup("production", p.status) !== "cancelled"
  );
  return usable.length === 1 ? idStr(usable[0].id) : "";
}

// ── 2. Auto source-ready ──────────────────────────────────────────────────

/**
 * Which clips move, for a Production in its NEW state.
 * @param {{ id: unknown, type: string, status: string }} production
 * @param {{ _id: unknown, type: string, status: string, statusBeforeHold?: string|null, details?: object }[]} clips
 * @returns {{ id: string, from: string, to: string }[]}
 */
export function sourceReadyMoves(production, clips) {
  if (production?.type !== "production" || production.status !== PRODUCTION_DONE) return [];
  const pid = idStr(production.id);
  return (clips ?? [])
    .filter(
      (c) =>
        c?.type === "clip" &&
        c.status === SOURCE_FROM &&
        idStr(c.details?.relatedProductionId) === pid &&
        // A system move bypasses the user permission check, never the arrows.
        canTransition("clip", c.status, SOURCE_TO, { statusBeforeHold: c.statusBeforeHold ?? null }).kind === "forward"
    )
    .map((c) => ({ id: idStr(c._id), from: c.status, to: SOURCE_TO }));
}

// ── 3. Primary action ─────────────────────────────────────────────────────

const CLIP_ACTIONS = {
  waiting_source: {
    to: "waiting_edit",
    label: "ยืนยันได้ Source แล้ว",
    helper: "ยืนยันเอง หรือระบบเปลี่ยนให้อัตโนมัติเมื่อ Production ที่เชื่อมไว้เสร็จ",
  },
  waiting_edit: { to: "editing", label: "เริ่มตัดต่อ", helper: "กดเมื่อเริ่มตัดต่อจริง ระบบบันทึกเวลาเริ่ม" },
  // Round 46 replaces these two plain moves with the Submit / Resubmit modals.
  editing: { to: "waiting_review", label: "ส่งตรวจ", helper: "ส่งให้ Reviewer ตรวจ" },
  waiting_review: { helper: "รอ Reviewer ตรวจ" },
  revising: { to: "waiting_review", label: "ส่งตรวจอีกครั้ง", helper: "ส่งตรวจใหม่หลังแก้ไข" },
  done: { copy: true, label: "คัดลอก File Location" },
};

/**
 * The Current Status card's action for a Clip, or null (no card action: paused,
 * cancelled, unknown status).
 * A move button shows only when the viewer may change this task's status AND the
 * move is a legal arrow; otherwise only the helper line. The copy button needs
 * no status right (it copies text), but only exists when there is a File Location.
 * @param {string} status
 * @param {{ canChangeStatus?: boolean, canOverride?: boolean, statusBeforeHold?: string|null, fileLocation?: string }} viewer
 * @returns {null | { button: null | { kind: "move", to: string, label: string } | { kind: "copy", label: string, value: string }, helper: string }}
 */
export function clipPrimaryAction(status, { canChangeStatus = false, canOverride = false, statusBeforeHold = null, fileLocation = "" } = {}) {
  const a = CLIP_ACTIONS[status];
  if (!a) return null;
  if (a.copy) {
    const value = String(fileLocation ?? "").trim();
    return value
      ? { button: { kind: "copy", label: a.label, value }, helper: value }
      : { button: null, helper: "ยังไม่มี File Location" };
  }
  if (!a.to) return { button: null, helper: a.helper };
  const ok = canChangeStatus && canTransition("clip", status, a.to, { canOverride, statusBeforeHold }).ok;
  return { button: ok ? { kind: "move", to: a.to, label: a.label } : null, helper: a.helper };
}
