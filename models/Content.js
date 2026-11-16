import mongoose from "mongoose";
import { CONTENT_DESCRIPTION_MAX, CONTENT_NAME_MAX, PROJECT_STATUSES } from "../lib/projects/rules.js";

const { ObjectId } = mongoose.Schema.Types;

// A deliverable inside a project (the project's Content tab).
const ContentSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: "Project", required: true, index: true },
    // Per-project sequence ("01", "02"…): max+1 at create, retried on a duplicate
    // key (see createContentAction). Never reused or renumbered.
    number: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: CONTENT_NAME_MAX },
    description: { type: String, trim: true, maxlength: CONTENT_DESCRIPTION_MAX, default: "" },
    briefLink: { type: String, trim: true, default: "" },
    // Derived from Tasks in a later round (lib/projects/status.js deriveContentStatus).
    status: { type: String, enum: PROJECT_STATUSES, default: "open" },
    createdBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "contents" }
);

ContentSchema.index({ project: 1, number: 1 }, { unique: true });

const Content = mongoose.models.Content || mongoose.model("Content", ContentSchema);

export default Content;
