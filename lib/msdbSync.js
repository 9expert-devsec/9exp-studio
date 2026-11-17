// MSDB → Studio DB mirror sync (msdb_refs + msdb_sync_state). Server only.
//
// The ONLY writer of the mirror. Triggers: the daily cron route
// (/api/cron/msdb-sync), "Sync now" on Team Management → Task Options, and the
// self-heal in lib/msdb.js. Idempotent (upserts by {kind, msdbId}).
//
// - Single flight: a sync that started < 2 min ago and hasn't finished makes
//   another call return { skipped: true }.
// - Per list: a list that fails (or comes back empty) leaves that kind's rows
//   untouched and records the error; the others still sync.
// - Rows missing from a successful list are marked active:false (never deleted).

import "server-only";
import dbConnect from "@/lib/db";
import { MSDB_API_SOURCES, fetchMsdbList, msdbRefUpsert, programIconIndex, toMsdbRef } from "@/lib/msdbApi";
import MsdbRef, { MSDB_REF_KINDS } from "@/models/MsdbRef";
import MsdbSyncState from "@/models/MsdbSyncState";

const STATE_ID = "msdb";
const LOCK_MS = 2 * 60 * 1000;

/** Take the lock; false when another sync holds a fresh one. */
async function acquireLock(now, reason) {
  try {
    const doc = await MsdbSyncState.findOneAndUpdate(
      { _id: STATE_ID, $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(now - LOCK_MS) } }] },
      { $set: { lockedAt: now, lastAttemptAt: now, lastReason: reason } },
      { upsert: true, returnDocument: "after" }
    );
    return !!doc;
  } catch (err) {
    if (err?.code === 11000) return false; // exists and is locked
    throw err;
  }
}

/** Write one successfully fetched list; returns its counts. */
async function writeKind(kind, rawItems, programIcons, now) {
  const refs = [];
  const seen = new Set();
  for (const doc of rawItems) {
    const ref = toMsdbRef(kind, doc, { programIcons });
    if (ref && !seen.has(ref.msdbId)) {
      seen.add(ref.msdbId);
      refs.push(ref);
    }
  }
  if (!refs.length) throw new Error("no usable records");
  await MsdbRef.bulkWrite(refs.map((r) => msdbRefUpsert(r, now)), { ordered: false });
  const gone = await MsdbRef.updateMany(
    { kind, msdbId: { $nin: [...seen] }, active: true },
    { $set: { active: false, syncedAt: now } }
  );
  return {
    fetched: refs.length,
    active: refs.filter((r) => r.active).length,
    withIcon: refs.filter((r) => r.iconUrl).length,
    deactivated: gone.modifiedCount ?? 0,
  };
}

/**
 * @param {{ reason?: string }} [opts]
 * @returns {Promise<{ skipped: true } | { ok: boolean, counts: object, error: string | null }>}
 */
export async function syncMsdbRefs({ reason = "manual" } = {}) {
  await dbConnect();
  const now = new Date();
  if (!(await acquireLock(now, String(reason).slice(0, 40)))) return { skipped: true };

  const counts = {};
  const errors = [];
  try {
    const fetched = await Promise.allSettled(MSDB_REF_KINDS.map((k) => fetchMsdbList(k)));
    const raw = Object.fromEntries(MSDB_REF_KINDS.map((k, i) => [k, fetched[i]]));

    // Course icons come from the program: fresh /programs, else the mirror.
    const programIcons =
      raw.program.status === "fulfilled"
        ? programIconIndex(raw.program.value)
        : programIconIndex(await MsdbRef.find({ kind: "program" }).select("msdbId code iconUrl").lean());

    for (const kind of MSDB_REF_KINDS) {
      const r = raw[kind];
      try {
        if (r.status === "rejected") throw r.reason;
        counts[kind] = await writeKind(kind, r.value, programIcons, now);
      } catch (err) {
        const msg = `${MSDB_API_SOURCES[kind].path}: ${err?.message || "failed"}`.slice(0, 200);
        counts[kind] = { error: msg };
        errors.push(msg);
      }
    }
  } catch (err) {
    errors.push(String(err?.message || "sync failed").slice(0, 200));
  }

  const ok = errors.length === 0;
  const lastError = ok ? null : errors.join("; ");
  if (!ok) console.error(`[msdb-sync] ${reason}: ${lastError}`);
  await MsdbSyncState.updateOne(
    { _id: STATE_ID },
    { $set: { lockedAt: null, counts, lastError, ...(ok ? { lastSuccessAt: new Date() } : {}) } }
  );
  return { ok, counts, error: lastError };
}

/** The sync status document (or null before the first sync). */
export async function readMsdbSyncState() {
  await dbConnect();
  return MsdbSyncState.findById(STATE_ID).lean();
}
