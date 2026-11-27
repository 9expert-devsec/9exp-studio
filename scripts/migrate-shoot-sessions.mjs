// Production shoot sessions migration (round 57.1). IDEMPOTENT.
//
// Usage (dry run — reads only, prints what it WOULD do):
//   node --env-file=.env.local scripts/migrate-shoot-sessions.mjs
// Apply:
//   node --env-file=.env.local scripts/migrate-shoot-sessions.mjs --apply
//
// What it does:
//   - Production tasks with the old single appointment details.shoot
//     { date, time, location } and NO details.shootSessions →
//     details.shootSessions = [{ _id, date, startTime: time, endTime: null, location }]
//   - details.shoot is KEPT (not deleted) — the app stops reading it once the list
//     exists; the next Edit save drops it.
//   - No Work Plan is created (a converted session has no end time).
//   - Photo details.shoot is left untouched (round 57.1: Photo no longer has it).
// Until it is applied the app reads details.shoot as one session
// (lib/tasks/shootSessions.js sessionsFromDetails). Raw collections only.

import mongoose from "mongoose";
import { sessionFromLegacyShoot } from "../lib/tasks/shootSessions.js";

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
    const production = await tasks.countDocuments({ type: "production" });
    const withList = await tasks.countDocuments({ type: "production", "details.shootSessions": { $exists: true } });
    const candidates = await tasks
      .find({ type: "production", "details.shoot": { $type: "object" }, "details.shootSessions": { $exists: false } }, { projection: { "details.shoot": 1, title: 1 } })
      .toArray();
    console.log(`\nProduction tasks: ${production} · already with shootSessions: ${withList} · with an old details.shoot to convert: ${candidates.length}`);

    let converted = 0;
    let skipped = 0;
    for (const t of candidates) {
      const session = sessionFromLegacyShoot(t.details.shoot, new mongoose.Types.ObjectId().toHexString());
      if (!session) {
        skipped += 1;
        console.log(`  skip ${t._id} (incomplete shoot: ${JSON.stringify(t.details.shoot)})`);
        continue;
      }
      if (APPLY) {
        // Conditional: never overwrites a list written meanwhile (re-runs are no-ops).
        const res = await tasks.updateOne({ _id: t._id, "details.shootSessions": { $exists: false } }, { $set: { "details.shootSessions": [session] } });
        converted += res.modifiedCount;
      } else converted += 1;
      console.log(`  ${APPLY ? "set" : "would set"} ${t._id} → ${session.date} ${session.startTime}${session.location ? ` · ${session.location}` : ""}`);
    }
    console.log(`\n${APPLY ? "Converted" : "Would convert"}: ${converted} · skipped: ${skipped}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
