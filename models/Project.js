import mongoose from "mongoose";
import {
  DEFAULT_PROJECT_ICON,
  PROJECT_DESCRIPTION_MAX,
  PROJECT_ICON_KEYS,
  PROJECT_NAME_MAX,
  PROJECT_STATUSES,
  PROJECT_TYPES,
} from "../lib/projects/rules.js";

const { ObjectId } = mongoose.Schema.Types;

// Accounts are the `User` model (collection "users").
const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: PROJECT_NAME_MAX },
    icon: { type: String, enum: PROJECT_ICON_KEYS, default: DEFAULT_PROJECT_ICON },
    type: { type: String, enum: PROJECT_TYPES, required: true },
    // Date-only values, stored as UTC midnight of the picked YYYY-MM-DD.
    startDate: { type: Date, required: true },
    // Required (>= startDate) for campaigns; null for ongoing. Enforced in
    // lib/projects/validate.js (the server actions), which also clears it on ongoing.
    endDate: { type: Date, default: null },
    description: { type: String, trim: true, maxlength: PROJECT_DESCRIPTION_MAX, default: "" },
    briefLink: { type: String, trim: true, default: "" },
    // Always the creator; not editable yet.
    owner: { type: ObjectId, ref: "User", required: true },
    // Excludes the owner (deduped server-side).
    members: { type: [{ type: ObjectId, ref: "User" }], default: [] },
    // Auto by design (see lib/projects/status.js). This round: open, or cancelled by hand.
    status: { type: String, enum: PROJECT_STATUSES, default: "open" },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: ObjectId, ref: "User", default: null },
    createdBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "projects" }
);

ProjectSchema.index({ owner: 1 });
ProjectSchema.index({ members: 1 });
ProjectSchema.index({ updatedAt: -1 });

const Project = mongoose.models.Project || mongoose.model("Project", ProjectSchema);

export default Project;
