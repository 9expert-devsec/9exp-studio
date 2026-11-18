import mongoose from "mongoose";

// Mirror of the MSDB master data Studio needs for the task "Related" pickers
// (public/online courses, programs, skills). Written ONLY by lib/msdbSync.js
// (cron, "Sync now", self-heal). Rows missing from a full sync are marked
// active:false, never deleted, so stored task snapshots keep resolving.
export const MSDB_REF_KINDS = ["public_course", "online_course", "program", "skill"];

const MsdbRefSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: MSDB_REF_KINDS, required: true },
    msdbId: { type: String, required: true }, // MSDB record _id (hex string)
    code: { type: String, default: "" },
    name: { type: String, default: "" },
    // Courses: their program's icon (online: else their own image). Absolute URL or null.
    iconUrl: { type: String, default: null },
    programMsdbId: { type: String, default: null }, // courses only
    // Public courses only: in-house-only (MSDB course_type_public: false). Shown
    // with an "In-house" badge; still active.
    isInhouse: { type: Boolean, default: false },
    // false = missing from the last successful MSDB sync (never "in-house").
    active: { type: Boolean, default: true },
    searchText: { type: String, default: "" }, // lower-cased "code name"
    syncedAt: { type: Date, required: true },
  },
  { collection: "msdb_refs" }
);

MsdbRefSchema.index({ kind: 1, msdbId: 1 }, { unique: true });
MsdbRefSchema.index({ kind: 1, active: 1 });

const MsdbRef = mongoose.models.MsdbRef || mongoose.model("MsdbRef", MsdbRefSchema);

export default MsdbRef;
