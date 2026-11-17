// MSDB "Related" search — reads the Studio DB mirror (msdb_refs). Server only.
//
// No MSDB API call on the normal search path. The mirror is filled by
// lib/msdbSync.js (daily cron, "Sync now"); this module only self-heals:
//   - the mirror for a kind is empty → one sync inline, then search;
//   - lastSuccessAt older than 36 h → a background sync (after the response),
//     at most once per 15 min of attempts, never blocking the search.
//
// Snapshot kinds (stored on tasks): "public" | "online" | "program" | "skill".
// Snapshot shape: { source: "msdb", kind, id, code, name, iconUrl }.

import "server-only";
import { after } from "next/server";
import dbConnect from "@/lib/db";
import { MsdbUnavailableError } from "@/lib/msdbApi";
import { syncMsdbRefs } from "@/lib/msdbSync";
import { escapeRegex } from "@/lib/projects/rules";
import MsdbRef from "@/models/MsdbRef";
import MsdbSyncState from "@/models/MsdbSyncState";

const MAX_RESULTS = 20;
const STALE_MS = 36 * 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;

/** Snapshot kind → mirror kind. */
const MIRROR_KIND = { public: "public_course", online: "online_course", program: "program", skill: "skill" };
const SNAPSHOT_KIND = Object.fromEntries(Object.entries(MIRROR_KIND).map(([s, m]) => [m, s]));
export const COURSE_KINDS = ["public", "online"];
export { MsdbUnavailableError };

const toSnapshot = (row) => ({
  source: "msdb",
  kind: SNAPSHOT_KIND[row.kind],
  id: row.msdbId,
  code: row.code ?? "",
  name: row.name ?? "",
  iconUrl: row.iconUrl ?? null,
});

const isStale = (state) => !state?.lastSuccessAt || Date.now() - new Date(state.lastSuccessAt).getTime() > STALE_MS;

/** Sync without blocking the caller (after the response when in a request). */
function syncInBackground(reason) {
  const run = () => syncMsdbRefs({ reason }).catch((err) => console.error(`[msdb] background sync failed: ${err?.message}`));
  try {
    after(run);
  } catch {
    void run(); // outside a request scope
  }
}

// kind → last time ensureMirror found rows (per server instance), so a burst of
// keystrokes costs one query each, not three.
const checkedAt = new Map();
const CHECK_MS = 60 * 1000;

/** Self-heal before reading `kind` (a mirror kind). Throws MsdbUnavailableError if still empty. */
async function ensureMirror(kind) {
  await dbConnect();
  if (Date.now() - (checkedAt.get(kind) ?? 0) < CHECK_MS) return;
  const [hasRows, state] = await Promise.all([MsdbRef.exists({ kind }), MsdbSyncState.findById("msdb").lean()]);
  if (!hasRows) {
    await syncMsdbRefs({ reason: `self-heal:empty:${kind}` }).catch(() => null);
    if (!(await MsdbRef.exists({ kind }))) throw new MsdbUnavailableError(`mirror empty: ${kind}`);
  } else {
    const lastAttempt = state?.lastAttemptAt ? new Date(state.lastAttemptAt).getTime() : 0;
    if (isStale(state) && Date.now() - lastAttempt > RETRY_MS) syncInBackground("self-heal:stale");
  }
  checkedAt.set(kind, Date.now());
}

async function search(snapshotKind, q) {
  const kind = MIRROR_KIND[snapshotKind];
  await ensureMirror(kind);
  const term = String(q ?? "").trim().slice(0, 100).toLowerCase();
  const filter = { kind, active: true };
  if (term) filter.searchText = new RegExp(escapeRegex(term), "i");
  const rows = await MsdbRef.find(filter).select("kind msdbId code name iconUrl").sort({ name: 1 }).limit(MAX_RESULTS).lean();
  return rows.map(toSnapshot);
}

/** @param {{ q: string, kind: "public" | "online" }} args */
export const searchCourses = ({ q, kind }) => search(COURSE_KINDS.includes(kind) ? kind : "public", q);
export const searchPrograms = (q) => search("program", q);
export const searchSkills = (q) => search("skill", q);

/** One ACTIVE record by MSDB id as a snapshot, or null. A miss on a stale mirror syncs once inline. */
export async function getMsdbSnapshot(snapshotKind, id) {
  const kind = MIRROR_KIND[snapshotKind];
  if (!kind || typeof id !== "string" || !id) return null;
  await ensureMirror(kind);
  const find = () => MsdbRef.findOne({ kind, msdbId: id, active: true }).lean();
  let row = await find();
  if (!row && isStale(await MsdbSyncState.findById("msdb").lean())) {
    await syncMsdbRefs({ reason: "self-heal:snapshot-miss" }).catch(() => null);
    row = await find();
  }
  return row ? toSnapshot(row) : null;
}

/**
 * Old task snapshots (saved before iconUrl existed): fill iconUrl from the
 * mirror when available. Never syncs; missing rows leave the snapshot as-is.
 * @param {Array<object | null>} snapshots
 */
export async function withMirrorIcons(snapshots) {
  const need = snapshots.filter((s) => s && s.source === "msdb" && s.iconUrl === undefined && MIRROR_KIND[s.kind]);
  if (!need.length) return snapshots;
  await dbConnect();
  const rows = await MsdbRef.find({ $or: need.map((s) => ({ kind: MIRROR_KIND[s.kind], msdbId: s.id })) })
    .select("kind msdbId iconUrl")
    .lean();
  const icon = new Map(rows.map((r) => [`${r.kind}:${r.msdbId}`, r.iconUrl ?? null]));
  return snapshots.map((s) => (s && need.includes(s) ? { ...s, iconUrl: icon.get(`${MIRROR_KIND[s.kind]}:${s.id}`) ?? null } : s));
}
