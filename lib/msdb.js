// MSDB "Related" search — reads the Studio DB mirror (msdb_refs). Server only.
//
// No MSDB API call on the normal search path. The mirror is filled by
// lib/msdbSync.js (daily cron, "Sync now"); this module only self-heals:
//   - the mirror for a kind is empty → one sync inline, then search;
//   - lastSuccessAt older than 36 h → a background sync (after the response),
//     at most once per 15 min of attempts, never blocking the search.
//
// Items are the picker's flat shape (lib/tasks/related.js):
//   { kind: "public_course" | "online_course" | "program" | "skill", refId, code, name, iconUrl, isInhouse }

import "server-only";
import { after } from "next/server";
import dbConnect from "@/lib/db";
import { MsdbUnavailableError } from "@/lib/msdbApi";
import { syncMsdbRefs } from "@/lib/msdbSync";
import { escapeRegex } from "@/lib/projects/rules";
import { RELATED_KINDS, RELATED_TYPES } from "@/lib/tasks/related";
import MsdbRef from "@/models/MsdbRef";
import MsdbSyncState from "@/models/MsdbSyncState";

const MAX_RESULTS = 20;
const STALE_MS = 36 * 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;
const FIELDS = "kind msdbId code name iconUrl isInhouse active";

export { MsdbUnavailableError };

const toItem = (row) => ({
  kind: row.kind,
  refId: row.msdbId,
  code: row.code ?? "",
  name: row.name ?? "",
  iconUrl: row.iconUrl ?? null,
  isInhouse: !!row.isInhouse,
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

/** Self-heal before reading `kinds` (mirror kinds). Throws MsdbUnavailableError if still empty. */
async function ensureMirror(kinds) {
  await dbConnect();
  const key = kinds.join(",");
  if (Date.now() - (checkedAt.get(key) ?? 0) < CHECK_MS) return;
  const [hasRows, state] = await Promise.all([
    MsdbRef.exists({ kind: { $in: kinds } }),
    MsdbSyncState.findById("msdb").lean(),
  ]);
  if (!hasRows) {
    await syncMsdbRefs({ reason: `self-heal:empty:${key}` }).catch(() => null);
    if (!(await MsdbRef.exists({ kind: { $in: kinds } }))) throw new MsdbUnavailableError(`mirror empty: ${key}`);
  } else {
    const lastAttempt = state?.lastAttemptAt ? new Date(state.lastAttemptAt).getTime() : 0;
    if (isStale(state) && Date.now() - lastAttempt > RETRY_MS) syncInBackground("self-heal:stale");
  }
  checkedAt.set(key, Date.now());
}

/**
 * Search one Related Type ("course" = public + online courses together,
 * "program", "skill"): ACTIVE rows only, case-insensitive on code + name
 * (regex-escaped), max 20, by name.
 */
export async function searchRelated({ type, q }) {
  const kinds = RELATED_TYPES.find((t) => t.key === type)?.kinds;
  if (!kinds) return [];
  await ensureMirror(kinds);
  const term = String(q ?? "").trim().slice(0, 100);
  const filter = { kind: { $in: kinds }, active: true };
  if (term) filter.searchText = new RegExp(escapeRegex(term.toLowerCase()), "i");
  const rows = await MsdbRef.find(filter).select(FIELDS).sort({ name: 1 }).limit(MAX_RESULTS).lean();
  return rows.map(toItem);
}

/**
 * One mirror row by kind + MSDB id, ACTIVE OR INACTIVE (an already-linked item
 * that later went missing from MSDB stays valid), or null. A miss on a stale
 * mirror syncs once inline.
 */
export async function getRelatedRef(kind, refId) {
  if (!RELATED_KINDS.includes(kind) || typeof refId !== "string" || !refId) return null;
  await ensureMirror([kind]);
  const find = () => MsdbRef.findOne({ kind, msdbId: refId }).select(FIELDS).lean();
  let row = await find();
  if (!row && isStale(await MsdbSyncState.findById("msdb").lean())) {
    await syncMsdbRefs({ reason: "self-heal:ref-miss" }).catch(() => null);
    row = await find();
  }
  return row ? toItem(row) : null;
}

/**
 * Fill a stored related snapshot's iconUrl / isInhouse from the mirror (for
 * tasks saved before those existed). Never syncs; a missing row leaves it as-is.
 * @param {{ kind: string, refId: string, snapshot: object } | null} related
 */
export async function withMirrorDetails(related) {
  if (!related || (related.snapshot.iconUrl && related.kind !== "public_course")) return related;
  await dbConnect();
  const row = await MsdbRef.findOne({ kind: related.kind, msdbId: related.refId }).select("iconUrl isInhouse").lean();
  if (!row) return related;
  return {
    ...related,
    snapshot: { ...related.snapshot, iconUrl: related.snapshot.iconUrl ?? row.iconUrl ?? null, isInhouse: !!row.isInhouse },
  };
}
