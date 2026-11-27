// Status & Progress view (round 48) — pure (no DB, no React). For Production,
// Graphic and Photo it returns everything the Task Detail right panel draws:
//   steps    lib/tasks/stepper.js (catalog step groups; Graphic แก้ไข = warning)
//   box      the Current Status box: icon key, Thai status name, sub-line
//   action   ONE of: a primary button / an outlined button (label + actionId +
//            hint), a hint only, or an info card
// Clip keeps its own round-45/46 card (lib/tasks/clipFlow.js) — not moved here.
//
// FLOW_ACTIONS is THE table of the primary-button moves (actionId → from → to,
// what the dialog collects, which timestamp it stores in Task.flow). The server
// action (task-actions.js runFlowAction) reads the same table and still goes
// through transitions.js canTransition.

import { formatThaiDay, formatThaiDayTime } from "../projects/format.js";
import { buildStatusStepper } from "./stepper.js";
import { canTransition } from "./transitions.js";
import { statusInfo } from "./types.js";
import { isDateStr, toMin } from "./workplan.js";

export const STATUS_VIEW_TYPES = ["production", "graphic", "photo"];
export const hasStatusView = (type) => STATUS_VIEW_TYPES.includes(type);

/**
 * Primary-button moves. `dialog`: "shoot" (appointment), "fileLocation"; `stamp`:
 * the Task.flow key set to now. Review actions (submit / resubmit / review) and
 * copy are not status moves here (round 46 dialogs / clipboard).
 */
export const FLOW_ACTIONS = {
  production: {
    set_shoot: { from: "not_started", to: "scheduled", dialog: "shoot" },
    shot: { from: "scheduled", to: "shot", stamp: "shotAt" },
    card: { from: "shot", to: "done", dialog: "fileLocation", stamp: "doneAt" },
  },
  graphic: {
    start: { from: "not_started", to: "in_progress", stamp: "startedAt" },
  },
  photo: {
    shot: { from: "not_started", to: "shot", stamp: "shotAt" },
    filed: { from: "shot", to: "filed", dialog: "fileLocation", stamp: "filedAt" },
    edit_start: { from: "filed", to: "retouching", stamp: "editStartedAt" },
    ready: { from: "retouching", to: "ready", stamp: "readyAt" },
  },
};
export const flowAction = (type, actionId) => FLOW_ACTIONS[type]?.[actionId] ?? null;

export const SHOOT_LOCATION_MAX = 200;

/**
 * A posted appointment { date, time, location } → { value } (or { value: null }
 * when all empty and not `required`) or { errors: { shootDate?, shootTime?, shootLocation? } }.
 * All three are needed once any is filled.
 */
export function parseShoot(raw, { required = false } = {}) {
  const date = String(raw?.date ?? "").trim();
  const time = String(raw?.time ?? "").trim();
  const location = String(raw?.location ?? "").trim();
  if (!required && !date && !time && !location) return { value: null };
  const errors = {};
  if (!isDateStr(date)) errors.shootDate = "เลือกวันที่ถ่าย";
  if (toMin(time) == null) errors.shootTime = "ใส่เวลา (เช่น 13:00)";
  if (!location) errors.shootLocation = "ใส่สถานที่ถ่าย";
  else if (location.length > SHOOT_LOCATION_MAX) errors.shootLocation = `ไม่เกิน ${SHOOT_LOCATION_MAX} ตัวอักษร`;
  return Object.keys(errors).length ? { errors } : { value: { date, time, location } };
}

/** "28 พ.ย. 13:00" for a shoot { date, time }; "" when none. */
export const shootLabel = (shoot) => (shoot?.date ? `${formatThaiDay(shoot.date, { weekday: false })}${shoot.time ? ` ${shoot.time}` : ""}` : "");
export const hasShoot = (shoot) => !!(shoot?.date && shoot?.time && shoot?.location);

/**
 * May the ⋯ menu offer "เลื่อนวันนัดถ่าย"? An appointment exists and the status
 * is before ถ่ายแล้ว (Production: ยังไม่เริ่ม / นัดถ่ายแล้ว; Photo: ยังไม่เริ่ม).
 */
export const canReschedule = (type, status, shoot) =>
  hasShoot(shoot) && ((type === "production" && ["not_started", "scheduled"].includes(status)) || (type === "photo" && status === "not_started"));

const at = (v) => formatThaiDayTime(v) || "—";
const join = (...parts) => parts.filter(Boolean).join(" · ");

/**
 * @param {{ type: string, status: string, statusBeforeHold?: string|null, createdAt?: unknown,
 *           enteredAt?: unknown, flow?: object, shoot?: object|null, fileLocation?: string,
 *           assigneeName?: string|null, complete?: boolean, linkedClips?: number,
 *           canChangeStatus?: boolean, canOverride?: boolean,
 *           review?: { openSubmittedAt?: unknown, closedAt?: unknown, currentStatus?: string|null,
 *                      mine?: string[], canSubmit?: boolean, hasBase?: boolean } }} t
 *   enteredAt = when the task entered its current status (latest status change), the
 *   fallback for every "since" time; `complete` = Production's required data is there.
 * @returns {null | { steps, terminal, box: { icon, title, sub, subTitle?, truncate? }, action: object|null, canReschedule: boolean,
 *                    fileLocation: string }}  fileLocation = the dialog pre-fill
 */
export function buildStatusView(t) {
  if (!hasStatusView(t.type)) return null;
  const stepper = buildStatusStepper(t.type, t.status);
  const flow = t.flow ?? {};
  const title = statusInfo(t.type, t.status).label;
  const since = (key) => flow[key] ?? t.enteredAt;
  const can = (to) => !!t.canChangeStatus && canTransition(t.type, t.status, to, { canOverride: !!t.canOverride, statusBeforeHold: t.statusBeforeHold ?? null }).ok;
  const move = (actionId, label, hint) => {
    const a = flowAction(t.type, actionId);
    return { kind: "button", button: can(a.to) ? { label, actionId } : null, hint };
  };
  const copy = (hint) =>
    t.fileLocation
      ? { kind: "outline", button: { label: "คัดลอก File Location", actionId: "copy", value: t.fileLocation }, hint }
      : { kind: "outline", button: { label: "คัดลอก File Location", actionId: "copy", value: "", disabled: true }, hint: "ยังไม่มี File Location" };

  let box = { icon: "clock", title, sub: "" };
  let action = null;

  if (stepper.terminal) {
    box = { icon: stepper.terminal.kind === "cancelled" ? "x" : "pause", title, sub: t.enteredAt ? `ตั้งแต่ ${at(t.enteredAt)}` : "" };
    return { steps: stepper.steps, terminal: stepper.terminal, box, action: null, canReschedule: false, fileLocation: t.fileLocation ?? "" };
  }

  if (t.type === "production") {
    switch (t.status) {
      case "not_started":
        box = { icon: "clock", title, sub: join(`สร้างเมื่อ ${at(t.createdAt)}`, t.complete ? "ข้อมูลครบ" : "") };
        action = move("set_shoot", "ตั้งวันถ่ายทำ", "เลือกวัน เวลา และสถานที่ถ่าย");
        break;
      case "scheduled":
        box = { icon: "calendar", title, sub: hasShoot(t.shoot) ? join(`นัดถ่าย ${shootLabel(t.shoot)}`, t.shoot.location) : "ยังไม่ได้นัดถ่าย" };
        action = move("shot", "ถ่ายทำเรียบร้อย", "กดหลังถ่ายเสร็จ · เลื่อนวันนัดได้จากเมนู ⋯");
        break;
      case "shot":
        box = { icon: "camera", title, sub: `ถ่ายเสร็จ ${at(since("shotAt"))}` };
        action = move("card", "ลงการ์ดแล้ว", "ระบุ File Location ของไฟล์ที่ลงการ์ด");
        break;
      case "done":
        box = { icon: "check", title, sub: `ลงการ์ด ${at(since("doneAt"))}` };
        action = {
          kind: "info",
          info: {
            title: "ไม่มีสิ่งที่ต้องทำ",
            line: t.linkedClips ? "Task ตัดต่อที่เกี่ยวข้องเปลี่ยนเป็น Ready to Edit แล้ว" : "ไม่มี Task ตัดต่อที่เชื่อมไว้",
          },
        };
        break;
      default:
        break;
    }
  }

  if (t.type === "graphic") {
    const r = t.review ?? {};
    switch (t.status) {
      case "not_started":
        box = { icon: "clock", title, sub: join(`มอบหมาย ${formatThaiDay(dayOf(t.createdAt), { weekday: false })}`, `Designer: ${t.assigneeName ?? "ยังไม่มอบหมาย"}`) };
        action = move("start", "เริ่มทำ", "ระบบบันทึกเวลาเริ่มงาน");
        break;
      case "in_progress":
        box = { icon: "palette", title, sub: `เริ่ม ${at(since("startedAt"))}` };
        // After a step-back from แก้ไข the next submit is a Resubmit (round 46.1).
        action = {
          kind: "button",
          button: r.canSubmit ? (r.hasBase ? { label: "ส่งตรวจอีกครั้ง", actionId: "resubmit" } : { label: "ส่งตรวจ", actionId: "submit" }) : null,
          hint: r.hasBase ? "ส่งตรวจใหม่เฉพาะ Design · ใช้ลิงก์รีวิวเดิมเป็นค่าเริ่มต้น" : "แนบลิงก์รีวิว และยืนยัน Reviewer",
        };
        break;
      case "waiting_review":
        box = { icon: "eye", title, sub: `ส่งตรวจ ${at(r.openSubmittedAt ?? t.enteredAt)}` };
        action = (r.mine ?? []).includes("design")
          ? { kind: "button", button: { label: "ตรวจงาน", actionId: "review", section: "design" }, hint: "มุมมอง Reviewer · ผ่าน / ไม่ผ่าน · Feedback ไม่บังคับ" }
          : { kind: "hint", hint: "รอ Reviewer ตรวจ: Design" };
        break;
      case "revising":
        box = { icon: "warning", title, sub: join(`ผลตรวจ ${at(r.currentStatus === "revision" ? r.closedAt : t.enteredAt)}`, "ไม่ผ่าน") };
        action = {
          kind: "button",
          button: r.canSubmit ? { label: "ส่งตรวจใหม่", actionId: r.hasBase ? "resubmit" : "submit" } : null,
          hint: "ใช้ลิงก์รีวิวเดิมเป็นค่าเริ่มต้น",
        };
        break;
      case "done":
        box = {
          icon: "check",
          title,
          sub: r.currentStatus === "passed" ? join(`ผ่านการตรวจ ${at(r.closedAt)}`, "อัตโนมัติ") : `เสร็จ ${at(t.enteredAt)}`,
        };
        action = copy("ไฟล์งานสุดท้ายพร้อมใช้");
        break;
      default:
        break;
    }
  }

  if (t.type === "photo") {
    switch (t.status) {
      case "not_started":
        box = { icon: "clock", title, sub: hasShoot(t.shoot) ? join(`นัดถ่าย ${shootLabel(t.shoot)}`, t.shoot.location) : "ยังไม่ได้นัดถ่าย" };
        action = move("shot", "ถ่ายเสร็จแล้ว", "กดหลังถ่ายภาพเสร็จ");
        // No appointment: a text link opens the appointment dialog (no status change).
        if (!hasShoot(t.shoot) && t.canChangeStatus) action.link = { label: "ตั้งวันนัดถ่าย", actionId: "set_shoot_only" };
        break;
      case "shot":
        box = { icon: "camera", title, sub: `ถ่ายเสร็จ ${at(since("shotAt"))}` };
        action = move("filed", "ยืนยันไฟล์เข้าโฟลเดอร์", "ระบุ File Location ของโฟลเดอร์ภาพ");
        break;
      case "filed":
        box = { icon: "folder", title, sub: t.fileLocation || "ยังไม่มี File Location", subTitle: t.fileLocation || undefined, truncate: true };
        action = move("edit_start", "เริ่มแต่งภาพ", "ระบบบันทึกเวลาเริ่มแต่งภาพ");
        break;
      case "retouching":
        box = { icon: "palette", title, sub: `เริ่มแต่ง ${at(since("editStartedAt"))}` };
        action = move("ready", "แต่งเสร็จ พร้อมใช้งาน", "ยืนยันว่าไฟล์ที่แต่งแล้วอยู่ใน File Location");
        break;
      case "ready":
        box = { icon: "check", title, sub: `พร้อมใช้ ${at(since("readyAt"))}` };
        action = copy("ไฟล์ภาพพร้อมใช้งาน");
        break;
      default:
        break;
    }
  }

  return { steps: stepper.steps, terminal: null, box, action, canReschedule: canReschedule(t.type, t.status, t.shoot), fileLocation: t.fileLocation ?? "" };
}

/** A datetime → its Bangkok calendar day "YYYY-MM-DD" (for formatThaiDay). */
const bkk = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const dayOf = (v) => (v ? bkk.format(new Date(v)) : "");
