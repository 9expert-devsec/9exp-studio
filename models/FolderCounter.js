import mongoose from "mongoose";

// Folder ID counters (lib/tasks/folderCounter.js): one doc per month + suffix,
// key "YYMM-<suffix>" (e.g. "2611-G"); `seq` = the last number handed out (or
// reserved by the admin "next number"). Incremented atomically; never decreased
// below a number the system already issued.
const FolderCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, collection: "folder_counters" }
);

const FolderCounter = mongoose.models.FolderCounter || mongoose.model("FolderCounter", FolderCounterSchema);

export default FolderCounter;
