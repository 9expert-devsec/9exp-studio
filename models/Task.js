import mongoose from "mongoose";
import { TASK_DESCRIPTION_MAX, TASK_TITLE_MAX } from "../lib/projects/rules.js";
import { TASK_TYPE_KEYS } from "../lib/tasks/types.js";

const { ObjectId } = mongoose.Schema.Types;

// A unit of work inside a content item. Type and status keys come from the catalog
// (lib/tasks/types.js). `status` must be one of the type's statuses; that is
// checked against the catalog by every server action that writes it (create /
// change status), since it depends on `type`.
const TaskSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: "Project", required: true, index: true },
    content: { type: ObjectId, ref: "Content", required: true, index: true },
    // Per-content sequence ("TASK 01") from the atomic Content.taskSeq counter
    // (lib/projects/sequence.js). Never reused; the unique index is the backstop.
    number: { type: Number, required: true, min: 1 },
    // Manual display order within its content (drag to reorder; lib/projects/order.js).
    // Absent until the content's first reorder/duplicate → ordered by number.
    sortOrder: { type: Number },
    title: { type: String, required: true, trim: true, maxlength: TASK_TITLE_MAX },
    type: { type: String, enum: TASK_TYPE_KEYS, required: true },
    status: { type: String, required: true },
    // Round 40: the working status the task left when it was paused (hold) or
    // cancelled — Resume / Reopen return to it (lib/tasks/transitions.js
    // nextHoldMemory). null otherwise; missing on old tasks → the initial status.
    statusBeforeHold: { type: String, default: null },
    // Post "Status Asset" (informational, never in progress maths); null otherwise.
    assetStatus: { type: String, default: null },
    // A single person, optional.
    assignee: { type: ObjectId, ref: "User", default: null },
    // Optional datetimes (entered in Asia/Bangkok); dueAt >= startAt when both are
    // set (lib/tasks/details.js). Replaces the unused date-only `dueDate`.
    startAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    description: { type: String, trim: true, maxlength: TASK_DESCRIPTION_MAX, default: "" },
    // Type-specific fields, validated per type by lib/tasks/details.js (clip:
    // videoType, platforms, fileLocation, editingRequirements, referenceUrl,
    // related (ONE item, lib/tasks/related.js; legacy tasks may still hold
    // relatedCourse / relatedProgram / relatedSkill until next saved),
    // relatedProductionId (round 45: ONE Production task of the same project, or
    // null — lib/tasks/clipFlow.js), workLevel, contentReviewer, videoReviewer; graphic: platform, workType, items,
    // fileLocation, photos[{ url, publicId, width, height }], brief, referenceUrl,
    // related, workLevel, contentReviewer, designReviewer; photo: photoType,
    // related, editor, shoot). Production / Photo `shoot` (round 48): { date
    // "YYYY-MM-DD", time "HH:mm", location } or null; Production also keeps
    // fileLocation (set by "ลงการ์ดแล้ว"). Graphic File Location / Photo Folder Name + Location live
    // on the TaskFolder. {} = no details yet.
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Folder ID "YYMM-NNN<suffix>" (lib/tasks/folderId.js) — the link to a shared
    // TaskFolder (graphic → G, photo → P; round 36). Several tasks may share one;
    // Edit may switch it to another folder of the same project + suffix.
    folderId: { type: String, default: undefined },
    createdBy: { type: ObjectId, ref: "User", required: true },
    // Status-flow timestamps (round 48, lib/tasks/statusView.js FLOW_ACTIONS):
    // shotAt, doneAt, startedAt, filedAt, editStartedAt, readyAt — set by the
    // Task Detail primary buttons. Outside `details` so Edit never drops them.
    flow: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Who made the last write (create / edit / status change / duplicate), from
    // round 33 on; older tasks have none (Task Detail shows only the time).
    updatedBy: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "tasks", minimize: false }
);

TaskSchema.index({ content: 1, number: 1 }, { unique: true });
TaskSchema.index({ content: 1, updatedAt: -1 });
// Lookups only (sparse: most types have no Folder ID). NOT unique since round 36
// (shared folders): uniqueness lives on TaskFolder.folderId and the counter. The
// old unique index is replaced by scripts/migrate-task-folders.mjs.
TaskSchema.index({ folderId: 1 }, { sparse: true });

const Task = mongoose.models.Task || mongoose.model("Task", TaskSchema);

export default Task;
