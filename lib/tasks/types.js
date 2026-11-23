// Task type + status catalog: THE single source of truth. Labels, icons,
// descriptions, statuses (Thai UI labels), status groups, initial status and the
// enabled flag are read from here; nothing else hard-codes a type or status key.
// Pure (no server imports): shared by the model, server validation, read models
// and client components.
//
// A status "group" is what ALL progress maths uses. Groups are the four project
// statuses (lib/projects/status.js colours): open | in_progress | completed |
// cancelled. The FIRST status of a type is its initial status.
//
// `assetStatuses` (post only) is a SECOND, informational status ("Status Asset"),
// stored in Task.assetStatus. It never takes part in progress maths.

import { Camera, Clapperboard, FileText, Image, List, SquarePlay } from "lucide-react";

const s = (key, label, group) => ({ key, label, group });

const TASK_TYPES = [
  {
    key: "production",
    label: "Production",
    description: "Plan and produce video content.",
    icon: Clapperboard,
    // Round 38: enabled (still subject to the role → task-type permission).
    enabled: true,
    statuses: [
      s("not_started", "ยังไม่เริ่ม", "open"),
      s("scheduled", "นัดถ่ายแล้ว", "in_progress"),
      s("shot", "ถ่ายแล้ว", "in_progress"),
      s("done", "เสร็จสมบูรณ์", "completed"),
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
  },
  {
    key: "clip",
    label: "Clip",
    description: "Edit short-form videos and clips.",
    icon: SquarePlay,
    enabled: true,
    statuses: [
      // Round 40: new tasks start at รอ Source (round 42 moves them on automatically).
      s("waiting_source", "รอ Source", "open"),
      s("waiting_edit", "รอตัดต่อ", "open"),
      s("editing", "กำลังตัดต่อ", "in_progress"),
      s("waiting_review", "รอตรวจ", "in_progress"),
      s("revising", "แก้ไข", "in_progress"),
      s("done", "เสร็จสมบูรณ์", "completed"),
      { ...s("paused", "หยุดดำเนินการ", "in_progress"), hold: true },
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
  },
  {
    key: "graphic",
    label: "Graphic",
    description: "Create visuals and design assets.",
    icon: Image,
    enabled: true,
    statuses: [
      s("not_started", "ยังไม่เริ่ม", "open"), // round 40: the new initial status
      s("in_progress", "กำลังดำเนินการ", "in_progress"),
      s("waiting_review", "รอตรวจสอบ", "in_progress"),
      s("revising", "แก้ไข", "in_progress"),
      s("done", "เสร็จสมบูรณ์", "completed"),
      // `hold`: a stop state — not a step in the Task Detail stepper ("On hold").
      // Group in_progress ON PURPOSE: a paused task keeps its project from Completed.
      { ...s("paused", "หยุดดำเนินการ", "in_progress"), hold: true },
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
  },
  {
    key: "post",
    label: "Post",
    description: "Prepare content for social media.",
    icon: List,
    enabled: true,
    // "Status Post": the only post status that drives progress.
    statuses: [
      s("drafting", "ร่างแผนงาน", "open"),
      s("waiting_assets", "รอชิ้นงาน", "in_progress"),
      s("scheduled", "รอเผยแพร่", "in_progress"),
      s("published", "เผยแพร่แล้ว", "completed"),
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
    // "Status Asset": informational only, derived from the Related Assets
    // (lib/tasks/assets.js). Keys used by deriveAssetStatus.
    assetStatuses: [
      { key: "not_ready", label: "ยังไม่พร้อม" },
      { key: "partial", label: "พร้อมบางส่วน" },
      { key: "ready", label: "พร้อม" },
      { key: "not_needed", label: "ไม่ต้องการ" },
    ],
  },
  {
    key: "article",
    label: "Article",
    description: "Write articles and blog content.",
    icon: FileText,
    enabled: true,
    statuses: [
      s("not_started", "ยังไม่เริ่ม", "open"),
      s("drafting", "ร่างบทความ", "in_progress"),
      s("waiting_assets", "รอชิ้นงาน", "in_progress"),
      s("scheduled", "รอเผยแพร่", "in_progress"),
      s("published", "เผยแพร่แล้ว", "completed"),
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
  },
  {
    key: "photo",
    label: "Photo",
    description: "Capture, select and edit photos.",
    icon: Camera,
    enabled: true,
    statuses: [
      s("not_started", "ยังไม่เริ่ม", "open"),
      s("shot", "ถ่ายแล้ว", "in_progress"),
      s("filed", "ไฟล์เข้าโฟลเดอร์แล้ว", "in_progress"),
      s("retouching", "กำลังแต่งภาพ", "in_progress"),
      s("ready", "พร้อมใช้งาน", "completed"), // replaces `retouched` (legacy alias below)
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
  },
];

/**
 * Types a Post can link as Related Assets, with the statuses that count as DONE
 * and as CANCELLED for its derived Status Asset (lib/tasks/assets.js).
 */
export const ASSET_TASK_TYPES = {
  clip: { done: ["done"], cancelled: ["cancelled"] }, // เสร็จสมบูรณ์ / ยกเลิก
  graphic: { done: ["done"], cancelled: ["cancelled"] }, // เสร็จสมบูรณ์ / ยกเลิก
  photo: { done: ["ready"], cancelled: ["cancelled"] }, // พร้อมใช้งาน / ยกเลิก
  article: { done: ["published"], cancelled: ["cancelled"] }, // เผยแพร่แล้ว / ยกเลิก
};
export const ASSET_TASK_TYPE_KEYS = Object.keys(ASSET_TASK_TYPES);

const BY_KEY = new Map(TASK_TYPES.map((t) => [t.key, t]));

/** Every type key, in display order (the model's enum). */
export const TASK_TYPE_KEYS = TASK_TYPES.map((t) => t.key);

/** All types in display order (the drawer shows disabled ones too). */
export const taskTypes = () => TASK_TYPES;

/** @returns {object | null} */
export const getTaskType = (key) => BY_KEY.get(key) ?? null;

export const isTaskTypeEnabled = (key) => !!getTaskType(key)?.enabled;

export const enabledTaskTypes = () => TASK_TYPES.filter((t) => t.enabled);

/** The type's first status, or null (unknown or disabled with no statuses). */
export const initialStatus = (type) => getTaskType(type)?.statuses[0]?.key ?? null;

/** The statuses of a type ([] when unknown). */
export const taskStatuses = (type) => getTaskType(type)?.statuses ?? [];

/**
 * Legacy status keys (round 40) that tasks may still store until
 * scripts/migrate-task-statuses.mjs is applied. READ side only: they render, count
 * and move as their replacement; isValidStatus rejects them as a NEW value.
 */
export const LEGACY_STATUS_ALIASES = {
  photo: { retouched: "ready" },
  post: { revising: "drafting" },
};

/** A stored status key with legacy aliases resolved — THE one place they apply. */
export const canonicalStatus = (type, statusKey) => LEGACY_STATUS_ALIASES[type]?.[statusKey] ?? statusKey;

/** The catalog entry of a stored status (legacy aliases resolved), or null. */
export const findStatus = (type, statusKey) =>
  taskStatuses(type).find((x) => x.key === canonicalStatus(type, statusKey)) ?? null;

/**
 * { label, group } for a stored status (legacy aliases resolved). Unknown → the
 * raw key, group "open", so a bad value still renders and counts conservatively.
 */
export function statusInfo(type, statusKey) {
  const found = findStatus(type, statusKey);
  return found ? { label: found.label, group: found.group } : { label: String(statusKey ?? ""), group: "open" };
}

export const statusGroup = (type, statusKey) => statusInfo(type, statusKey).group;

/** A status that may be SAVED (strict: legacy keys are not valid new values). */
export const isValidStatus = (type, statusKey) => taskStatuses(type).some((x) => x.key === statusKey);

// Work level (clip details now; other types may reuse it).
export const WORK_LEVELS = [
  { key: "easy", label: "Easy" },
  { key: "normal", label: "Normal" },
  { key: "hard", label: "Hard" },
];
export const WORK_LEVEL_KEYS = WORK_LEVELS.map((w) => w.key);
export const workLevelLabel = (key) => WORK_LEVELS.find((w) => w.key === key)?.label ?? "";

// Status Asset (types that define assetStatuses: post). DERIVED from the post's
// Related Assets (lib/tasks/assets.js deriveAssetStatus), never set by hand.
export const assetStatuses = (type) => getTaskType(type)?.assetStatuses ?? [];
export const hasAssetStatus = (type) => assetStatuses(type).length > 0;
export const initialAssetStatus = (type) => assetStatuses(type)[0]?.key ?? null;
export const isValidAssetStatus = (type, key) => assetStatuses(type).some((x) => x.key === key);
export const assetStatusLabel = (type, key) => assetStatuses(type).find((x) => x.key === key)?.label ?? "";
