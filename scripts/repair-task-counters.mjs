// Repair task/content numbering (round 39). IDEMPOTENT.
//
// Usage (dry run — reads only, prints what it WOULD do):
//   node --env-file=.env.local scripts/repair-task-counters.mjs
// Apply:
//   node --env-file=.env.local scripts/repair-task-counters.mjs --apply
//
// What it does:
//   1. contents.taskSeq (scope: per content, matching the unique tasks index
//      {content, number}): raise it to at least the content's highest task
//      number. projects.contentSeq (per project, unique {project, number} on
//      contents): the same. Counters are only ever raised ($max), never lowered;
//      missing counters are left for the app to initialise.
//   2. tasks index `folderId_1`: if it is still UNIQUE (left from before shared
//      folders, round 36) it blocks a second task in the same folder with E11000
//      — drop it and create the non-unique sparse one (same as
//      scripts/migrate-task-folders.mjs step 1).
// Prints every change. Raw collections only (no Mongoose models). Pure planning
// step: lib/projects/dupKey.js planCounterRepairs.

import mongoose from "mongoose";
import { planCounterRepairs } from "../lib/projects/dupKey.js";

const APPLY = process.argv.includes("--apply");
const FOLDER_INDEX = "folderId_1";

async function maxNumbers(collection, parentKey) {
  const rows = await collection.aggregate([{ $group: { _id: `$${parentKey}`, max: { $max: "$number" } } }]).toArray();
  return new Map(rows.filter((r) => r._id).map((r) => [String(r._id), r.max ?? 0]));
}

async function repairCounters(label, parents, field, children, parentKey) {
  const maxBy = await maxNumbers(children, parentKey);
  const docs = await parents.find({}, { projection: { [field]: 1, name: 1, number: 1 } }).toArray();
  const names = new Map(docs.map((d) => [String(d._id), d.name ?? ""]));
  const plan = planCounterRepairs(docs.map((d) => ({ id: String(d._id), counter: d[field] })), maxBy);
  console.log(`${label}: ${docs.length} checked, ${plan.length} behind`);
  for (const p of plan) {
    if (APPLY) {
      await parents.updateOne({ _id: new mongoose.Types.ObjectId(p.id) }, { $max: { [field]: p.to } });
    }
    console.log(`  ${APPLY ? "set" : "would set"} ${field} ${p.from} → ${p.to}  (${p.id} "${names.get(p.id)}")`);
  }
  return plan.length;
}

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
  const contents = db.collection("contents");
  const projects = db.collection("projects");
  console.log(APPLY ? "Mode: APPLY (writes)" : "Mode: DRY RUN (no writes; add --apply to write)");

  try {
    // 1. Counters.
    await repairCounters("contents.taskSeq", contents, "taskSeq", tasks, "content");
    await repairCounters("projects.contentSeq", projects, "contentSeq", contents, "project");

    // 2. Stale unique folderId index on tasks.
    const current = (await tasks.indexes()).find((i) => i.name === FOLDER_INDEX);
    if (current?.unique) {
      if (APPLY) {
        await tasks.dropIndex(FOLDER_INDEX);
        await tasks.createIndex({ folderId: 1 }, { name: FOLDER_INDEX, sparse: true });
      }
      console.log(`tasks index ${FOLDER_INDEX}: UNIQUE → ${APPLY ? "dropped and recreated non-unique (sparse)" : "would drop and recreate non-unique (sparse)"}`);
    } else if (!current) {
      if (APPLY) await tasks.createIndex({ folderId: 1 }, { name: FOLDER_INDEX, sparse: true });
      console.log(`tasks index ${FOLDER_INDEX}: missing → ${APPLY ? "created non-unique (sparse)" : "would create non-unique (sparse)"}`);
    } else {
      console.log(`tasks index ${FOLDER_INDEX}: already non-unique — no change`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
