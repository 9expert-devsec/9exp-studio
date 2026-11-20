// One-off migration for shared task folders (round 36). IDEMPOTENT.
//
// Usage (dry run — reads only, prints what it WOULD do):
//   node --env-file=.env.local scripts/migrate-task-folders.mjs
// Apply:
//   node --env-file=.env.local scripts/migrate-task-folders.mjs --apply
//
// What it does:
//   1. tasks: drop the old UNIQUE index `folderId_1` (if present) and create the
//      new non-unique sparse `folderId_1` (lookups; several tasks share a folder).
//   2. task_folders: make sure its indexes exist (unique folderId; project +
//      suffix + createdAt for the Choose Folder list).
//   3. For every distinct `folderId` on existing tasks, upsert a TaskFolder:
//      project, createdBy, createdAt from the EARLIEST task using it; location =
//      that task's details.fileLocation (or ""); name "". Folders that already
//      exist are left untouched ($setOnInsert only).
// Prints counts. Plain Node script: raw collections only (no Mongoose models, so
// nothing auto-builds an index behind its back). Pure planning step:
// lib/tasks/folders.js planFolderMigration.

import mongoose from "mongoose";
import { planFolderMigration } from "../lib/tasks/folders.js";

const APPLY = process.argv.includes("--apply");
const OLD_INDEX = "folderId_1";

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  if (!uri || !dbName) {
    console.error("Error: MONGODB_URI and MONGODB_DB_NAME must be set (run with --env-file=.env.local).");
    process.exit(1);
  }
  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db;
  const tasks = db.collection("tasks");
  const folders = db.collection("task_folders");
  console.log(APPLY ? "Mode: APPLY (writes)" : "Mode: DRY RUN (no writes; add --apply to write)");

  try {
    // 1. Task index: unique → non-unique.
    const indexes = await tasks.indexes();
    const current = indexes.find((i) => i.name === OLD_INDEX);
    const uniqueFound = !!current?.unique;
    let dropped = false;
    let created = false;
    if (uniqueFound) {
      if (APPLY) await tasks.dropIndex(OLD_INDEX);
      dropped = APPLY;
    }
    if (!current || uniqueFound) {
      if (APPLY) await tasks.createIndex({ folderId: 1 }, { name: OLD_INDEX, sparse: true });
      created = APPLY;
    }
    console.log(
      `tasks index ${OLD_INDEX}: ${current ? (uniqueFound ? "found (unique)" : "found (already non-unique)") : "not found"}` +
        ` · dropped: ${dropped ? "yes" : uniqueFound ? "would drop" : "no"}` +
        ` · created non-unique: ${created ? "yes" : !current || uniqueFound ? "would create" : "no (already there)"}`
    );

    // 2. task_folders indexes (same as models/TaskFolder.js).
    if (APPLY) {
      await folders.createIndex({ folderId: 1 }, { unique: true });
      await folders.createIndex({ project: 1, suffix: 1, createdAt: -1 });
    }

    // 3. Back-fill one folder per distinct task folderId.
    const docs = await tasks
      .find({ folderId: { $exists: true, $nin: [null, ""] } })
      .project({ folderId: 1, project: 1, createdBy: 1, createdAt: 1, "details.fileLocation": 1 })
      .toArray();
    const plan = planFolderMigration(docs);
    const ids = plan.folders.map((f) => f.folderId);
    const existing = new Set(
      (await folders.find({ folderId: { $in: ids } }).project({ folderId: 1 }).toArray()).map((f) => f.folderId)
    );
    const toCreate = plan.folders.filter((f) => !existing.has(f.folderId));

    let inserted = 0;
    if (APPLY) {
      const now = new Date();
      for (const f of toCreate) {
        const res = await folders.updateOne(
          { folderId: f.folderId },
          {
            $setOnInsert: {
              folderId: f.folderId,
              suffix: f.suffix,
              project: f.project,
              name: f.name,
              location: f.location,
              createdBy: f.createdBy,
              createdAt: f.createdAt ?? now,
              updatedAt: now,
            },
          },
          { upsert: true }
        );
        inserted += res.upsertedCount;
      }
    }

    const shared = plan.folders.filter((f) => f.taskCount > 1).length;
    console.log(`tasks with a folderId: ${docs.length}`);
    console.log(`folders found (distinct folderId): ${plan.folders.length} (shared by 2+ tasks: ${shared})`);
    console.log(`folders already present: ${existing.size}`);
    console.log(`folders ${APPLY ? "created" : "to create"}: ${APPLY ? inserted : toCreate.length}`);
    if (plan.skipped.length) console.log(`skipped (unparseable folderId): ${plan.skipped.join(", ")}`);
    if (plan.multiProject.length) {
      console.log(`warning: used by tasks in more than one project (folder assigned to the earliest task's project): ${plan.multiProject.join(", ")}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(`Migration failed: ${err?.message ?? err}`);
  process.exit(1);
});
