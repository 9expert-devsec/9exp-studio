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
//
// Round 56: every status also has a cross-type STAGE ("กลุ่มสถานะ", All Tasks):
// not_started | doing | waiting | fix | done — or null for the stop states
// (ยกเลิก / หยุดดำเนินการ), which belong to none. Stages are DISPLAY / filter
// groups only; `group` above still drives every progress number.

import { Camera, Clapperboard, FileText, Image, List, SquarePlay } from "lucide-react";

const s = (key, label, group, stage = null) => ({ key, label, group, stage });

const TASK_TYPES = [
  {
    key: "production",
    // Timeline bar tint (light + dark; text keeps AA contrast on it).
    tone: "bg-emerald-200 text-emerald-950 dark:bg-emerald-400/25 dark:text-emerald-100",
    label: "Production",
    description: "Plan and produce video content.",
    icon: Clapperboard,
    // Round 38: enabled (still subject to the role → task-type permission).
    enabled: true,
    statuses: [
      s("not_started", "ยังไม่เริ่ม", "open", "not_started"),
      s("scheduled", "นัดถ่ายแล้ว", "in_progress", "doing"),
      s("shot", "ถ่ายแล้ว", "in_progress", "doing"),
      s("done", "เสร็จสมบูรณ์", "completed", "done"),
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
    // Round 48: 4 drawn steps; a grouping also draws เสร็จสมบูรณ์ as all-complete.
    stepGroups: [
      { key: "not_started", statuses: ["not_started"] },
      { key: "scheduled", statuses: ["scheduled"] },
      { key: "shot", statuses: ["shot"] },
      { key: "done", statuses: ["done"] },
    ],
  },
  {
    key: "clip",
    tone: "bg-violet-200 text-violet-950 dark:bg-violet-400/25 dark:text-violet-100",
    label: "Clip",
    description: "Edit short-form videos and clips.",
    icon: SquarePlay,
    enabled: true,
    statuses: [
      // Round 40: new tasks start at รอ Source (round 42 moves them on automatically).
      s("waiting_source", "รอ Source", "open", "not_started"),
      s("waiting_edit", "รอตัดต่อ", "open", "not_started"),
      s("editing", "กำลังตัดต่อ", "in_progress", "doing"),
      s("waiting_review", "รอตรวจ", "in_progress", "waiting"),
      s("revising", "แก้ไข", "in_progress", "fix"),
      s("done", "เสร็จสมบูรณ์", "completed", "done"),
      { ...s("paused", "หยุดดำเนินการ", "in_progress"), hold: true },
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
    // Round 45: the Task Detail stepper draws 5 steps (lib/tasks/stepper.js).
    // `label` defaults to the first status's catalog label; `warn` statuses sit
    // on the step with a warning icon + `warnNote` (frame 341:2231).
    stepGroups: [
      { key: "waiting_source", statuses: ["waiting_source"] },
      { key: "waiting_edit", statuses: ["waiting_edit"] },
      { key: "editing", statuses: ["editing"] },
      { key: "review", label: "ตรวจงาน", statuses: ["waiting_review", "revising"], warn: ["revising"], warnNote: "ต้องแก้ไข" },
      { key: "done", statuses: ["done"] },
    ],
  },
  {
    key: "graphic",
    tone: "bg-sky-200 text-sky-950 dark:bg-sky-400/25 dark:text-sky-100",
    label: "Graphic",
    description: "Create visuals and design assets.",
    icon: Image,
    enabled: true,
    statuses: [
      s("not_started", "ยังไม่เริ่ม", "open", "not_started"), // round 40: the new initial status
      s("in_progress", "กำลังดำเนินการ", "in_progress", "doing"),
      s("waiting_review", "รอตรวจสอบ", "in_progress", "waiting"),
      s("revising", "แก้ไข", "in_progress", "fix"),
      s("done", "เสร็จสมบูรณ์", "completed", "done"),
      // `hold`: a stop state — not a step in the Task Detail stepper ("On hold").
      // Group in_progress ON PURPOSE: a paused task keeps its project from Completed.
      { ...s("paused", "หยุดดำเนินการ", "in_progress"), hold: true },
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
    // Round 48: 4 drawn steps — แก้ไข sits on รอตรวจสอบ with a warning.
    stepGroups: [
      { key: "not_started", statuses: ["not_started"] },
      { key: "in_progress", statuses: ["in_progress"] },
      { key: "review", statuses: ["waiting_review", "revising"], warn: ["revising"], warnNote: "แก้ไข" },
      { key: "done", statuses: ["done"] },
    ],
  },
  {
    key: "post",
    tone: "bg-orange-200 text-orange-950 dark:bg-orange-400/25 dark:text-orange-100",
    label: "Post",
    description: "Prepare content for social media.",
    icon: List,
    enabled: true,
    // "Status Post": the only post status that drives progress.
    statuses: [
      s("drafting", "ร่างแผนงาน", "open", "doing"),
      s("waiting_assets", "รอชิ้นงาน", "in_progress", "waiting"),
      s("scheduled", "รอเผยแพร่", "in_progress", "waiting"),
      s("published", "เผยแพร่แล้ว", "completed", "done"),
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
    // "Status Asset": informational only, derived from the Related Assets
    // (lib/tasks/assets.js). Keys used by deriveAssetStatus.
    assetStatuses: [
      { key: "not_ready", label: "ยังไม่พร้อม" },
      { key: "partial", label: "พร้อมบางส่วน" },
      { key: "ready", label: "พร้อม" },
      { key: "not_needed", label: "ไม่ต้องการ" },
    ],    // Round 49: one step per status (เผยแพร่แล้ว draws all-complete); the
    // รอชิ้นงาน step is dashed / hidden / "ชิ้นงานครบ" in lib/tasks/statusView.js.
    stepGroups: ["drafting", "waiting_assets", "scheduled", "published"].map((k) => ({ key: k, statuses: [k] })),
  },
  {
    key: "article",
    tone: "bg-pink-200 text-pink-950 dark:bg-pink-400/25 dark:text-pink-100",
    label: "Article",
    description: "Write articles and blog content.",
    icon: FileText,
    enabled: true,
    statuses: [
      s("not_started", "ยังไม่เริ่ม", "open", "not_started"),
      s("drafting", "ร่างบทความ", "in_progress", "doing"),
      s("waiting_assets", "รอชิ้นงาน", "in_progress", "waiting"),
      s("scheduled", "รอเผยแพร่", "in_progress", "waiting"),
      s("published", "เผยแพร่แล้ว", "completed", "done"),
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
    stepGroups: ["not_started", "drafting", "waiting_assets", "scheduled", "published"].map((k) => ({ key: k, statuses: [k] })), // round 49
  },
  {
    key: "photo",
    tone: "bg-amber-200 text-amber-950 dark:bg-amber-400/25 dark:text-amber-100",
    label: "Photo",
    description: "Capture, select and edit photos.",
    icon: Camera,
    enabled: true,
    statuses: [
      s("not_started", "ยังไม่เริ่ม", "open", "not_started"),
      s("shot", "ถ่ายแล้ว", "in_progress", "doing"),
      s("filed", "ไฟล์เข้าโฟลเดอร์แล้ว", "in_progress", "doing"),
      s("retouching", "กำลังแต่งภาพ", "in_progress", "doing"),
      s("ready", "พร้อมใช้งาน", "completed", "done"), // replaces `retouched` (legacy alias below)
      s("cancelled", "ยกเลิก", "cancelled"),
    ],
    // Round 48: 5 drawn steps (one per status; the grouping draws พร้อมใช้งาน all-complete).
    stepGroups: ["not_started", "shot", "filed", "retouching", "ready"].map((k) => ({ key: k, statuses: [k] })),
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

/** Timeline bar tint classes for a type (neutral track for an unknown key). */
export const taskTypeTone = (key) => getTaskType(key)?.tone ?? "bg-track text-fg";

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

/** Optional stepper grouping of a type (round 45), or null = one step per status. */
export const taskStepGroups = (type) => getTaskType(type)?.stepGroups ?? null;

// ── Stages (round 56, All Tasks "กลุ่มสถานะ") ─────────────────────────────────
// Order = display order (legend, filter chips, group-by-stage). `dot` uses theme
// tokens: grey / orange / blue / amber / green.
export const TASK_STAGES = [
  { key: "not_started", label: "ยังไม่เริ่ม", dot: "bg-fg-muted" },
  { key: "doing", label: "กำลังทำ", dot: "bg-brand-500" },
  { key: "waiting", label: "รอ", dot: "bg-info" },
  { key: "fix", label: "ต้องแก้ไข", dot: "bg-warning" },
  { key: "done", label: "เสร็จ", dot: "bg-success" },
];
export const TASK_STAGE_KEYS = TASK_STAGES.map((x) => x.key);
/** The stop states (ยกเลิก / หยุดดำเนินการ): no stage; a filter chip of their own. */
export const STOPPED_STAGE = { key: "stopped", label: "ยกเลิก/หยุด", dot: "bg-danger" };
export const taskStage = (key) => TASK_STAGES.find((x) => x.key === key) ?? null;

/** The stage key of a stored status (legacy aliases resolved), or null (stop state / unknown). */
export const statusStage = (type, statusKey) => findStatus(type, statusKey)?.stage ?? null;

/**
 * Stored status keys per type whose stage is in `stages` ("stopped" = the
 * stage-less stop states), legacy alias keys included — for a DB `$in`.
 * @param {string[]} stages @returns {{ type: string, statuses: string[] }[]} (types with none omitted)
 */
export function statusKeysForStages(stages) {
  const want = new Set(stages);
  return TASK_TYPES.map((t) => {
    const keys = t.statuses.filter((x) => (x.stage ? want.has(x.stage) : want.has("stopped"))).map((x) => x.key);
    const legacy = Object.entries(LEGACY_STATUS_ALIASES[t.key] ?? {})
      .filter(([, to]) => keys.includes(to))
      .map(([from]) => from);
    return { type: t.key, statuses: [...keys, ...legacy] };
  }).filter((x) => x.statuses.length);
}

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
