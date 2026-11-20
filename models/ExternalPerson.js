import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A saved external presenter (round 38): someone without a Studio account,
// typed by name on a Production task and reused afterwards. Created by the task
// actions (lib/tasks/externalPeople.js) — one per `nameKey` (trimmed, lower-cased,
// spaces collapsed; lib/tasks/production.js externalNameKey), never duplicated.
// Managed under Team Management → Task Options → External Presenters. Inactive
// people are hidden from the picker but still show on tasks that use them.
const ExternalPersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, unique: true },
    note: { type: String, trim: true, maxlength: 300, default: "" },
    active: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "external_people" }
);

const ExternalPerson = mongoose.models.ExternalPerson || mongoose.model("ExternalPerson", ExternalPersonSchema);

export default ExternalPerson;
