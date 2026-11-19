import mongoose from "mongoose";
import { CONTENT_DESCRIPTION_MAX, CONTENT_NAME_MAX, PROJECT_STATUSES } from "../lib/projects/rules.js";

const { ObjectId } = mongoose.Schema.Types;

// A deliverable inside a project (the project's Content tab).
const ContentSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: "Project", required: true, index: true },
    // Per-project sequence ("01", "02"…) from the atomic Project.contentSeq counter
    // (see content-actions.js). Never reused or renumbered, even after deletes; the
    // unique index below is the backstop.
    number: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: CONTENT_NAME_MAX },
    description: { type: String, trim: true, maxlength: CONTENT_DESCRIPTION_MAX, default: "" },
    briefLink: { type: String, trim: true, default: "" },
    // Optional, date-only (UTC midnight of the picked YYYY-MM-DD), like project dates.
    dueDate: { type: Date, default: null },
    // Derived from its tasks (lib/projects/status.js deriveContentStatus) and
    // persisted by recomputeRollups() after every task write.
    status: { type: String, enum: PROJECT_STATUSES, default: "open" },
    createdBy: { type: ObjectId, ref: "User", required: true },
    // Last task number handed out (atomic $inc, lib/projects/sequence.js). No
    // default on purpose: when missing it is initialised from the current max.
    taskSeq: { type: Number },
    // Manual display order within the project (drag to reorder; lib/projects/order.js).
    // Absent until the project's first reorder/duplicate → ordered by number.
    sortOrder: { type: Number },
  },
  { timestamps: true, collection: "contents" }
);

ContentSchema.index({ project: 1, number: 1 }, { unique: true });

const Content = mongoose.models.Content || mongoose.model("Content", ContentSchema);

export default Content;
