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
    title: { type: String, required: true, trim: true, maxlength: TASK_TITLE_MAX },
    type: { type: String, enum: TASK_TYPE_KEYS, required: true },
    status: { type: String, required: true },
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
    // relatedCourse / relatedProgram / relatedSkill until next saved), workLevel,
    // contentReviewer, videoReviewer). {} = no details yet.
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "tasks", minimize: false }
);

TaskSchema.index({ content: 1, number: 1 }, { unique: true });
TaskSchema.index({ content: 1, updatedAt: -1 });

const Task = mongoose.models.Task || mongoose.model("Task", TaskSchema);

export default Task;
