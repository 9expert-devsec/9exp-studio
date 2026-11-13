import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A user's pinned projects (featured row). Max 2 per account, enforced in the
// pin server action (lib/projects/rules.js PROJECT_PIN_MAX).
const ProjectPinSchema = new mongoose.Schema(
  {
    account: { type: ObjectId, ref: "User", required: true },
    project: { type: ObjectId, ref: "Project", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "projectpins" }
);

ProjectPinSchema.index({ account: 1, project: 1 }, { unique: true });

const ProjectPin = mongoose.models.ProjectPin || mongoose.model("ProjectPin", ProjectPinSchema);

export default ProjectPin;
