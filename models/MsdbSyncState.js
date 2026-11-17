import mongoose from "mongoose";

// The single MSDB mirror sync status document (_id: "msdb"). `lockedAt` is the
// single-flight lock: set when a sync starts, cleared when it ends; a lock older
// than 2 minutes is treated as abandoned.
const MsdbSyncStateSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "msdb" },
    lastSuccessAt: { type: Date, default: null }, // every list synced OK
    lastAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    lastReason: { type: String, default: null },
    // kind → { active, withIcon, deactivated } or { error }
    counts: { type: mongoose.Schema.Types.Mixed, default: {} },
    lockedAt: { type: Date, default: null },
  },
  { collection: "msdb_sync_state", minimize: false }
);

const MsdbSyncState = mongoose.models.MsdbSyncState || mongoose.model("MsdbSyncState", MsdbSyncStateSchema);

export default MsdbSyncState;
