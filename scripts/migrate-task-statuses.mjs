// Task status migration for the round-40 status sets. IDEMPOTENT.
//
// Usage (dry run — reads only, prints what it WOULD do):
//   node --env-file=.env.local scripts/migrate-task-statuses.mjs
// Apply:
//   node --env-file=.env.local scripts/migrate-task-statuses.mjs --apply
//
// What it does:
//   - photo `retouched` (แต่งภาพเรียบร้อย) → `ready` (พร้อมใช้งาน)
//   - post `revising` (แก้ไข, removed) → `drafting` (ร่างแผนงาน)
//   - any task whose status is still not in its type's catalog: LISTED (id,
//     type, status), left untouched
//   - everything else untouched (clip / graphic / article keep their statuses;
//     existing Graphic tasks are NOT moved to ยังไม่เริ่ม)
// Until it is applied the app reads the legacy keys as their replacement
// (lib/tasks/types.js LEGACY_STATUS_ALIASES). Prints counts per type and status.
// Raw collections only (no Mongoose models). Pure planning step:
// lib/tasks/statusMigration.js planStatusMigration.

import mongoose from "mongoose";
import { planStatusMigration } from "../lib/tasks/statusMigration.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  if (!uri || !dbName) {
    console.error("Error: MONGODB_URI and MONGODB_DB_NAME must be set (run with --env-file=.env.local).");
    process.exit(1);
  }
  await mongoose.connect(uri, { dbName });
  const tasks = mongoose.connection.db.collection("tasks");
  console.log(APPLY ? "Mode: APPLY (writes)" : "Mode: DRY RUN (no writes; add --apply to write)");

  try {
    const all = await tasks.find({}, { projection: { type: 1, status: 1 } }).toArray();
    const { before, changes, unknown } = planStatusMigration(all);

    console.log(`\nTasks: ${all.length}. Counts per status (before):`);
    for (const type of Object.keys(before).sort()) {
      const row = Object.entries(before[type]).map(([s, n]) => `${s}=${n}`).join(", ");
      console.log(`  ${type}: ${row}`);
    }

    console.log(`\nChanges: ${changes.length}`);
    const byRule = new Map();
    for (const c of changes) {
      const k = `${c.type} ${c.from} → ${c.to}`;
      byRule.set(k, (byRule.get(k) ?? 0) + 1);
    }
    for (const [k, n] of byRule) console.log(`  ${k}: ${n}`);
    let written = 0;
    for (const c of changes) {
      if (APPLY) {
        // Conditional on the old value: re-running never touches a task twice.
        const res = await tasks.updateOne({ _id: new mongoose.Types.ObjectId(c.id), type: c.type, status: c.from }, { $set: { status: c.to } });
        written += res.modifiedCount;
      }
      console.log(`  ${APPLY ? "set" : "would set"} ${c.id} (${c.type}) ${c.from} → ${c.to}`);
    }
    if (APPLY) console.log(`  written: ${written}`);

    console.log(`\nNot in the catalog (left untouched): ${unknown.length}`);
    for (const u of unknown) console.log(`  ${u.id} ${u.type} ${u.status}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
