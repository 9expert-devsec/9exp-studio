// MSDB AI API client (GET only) + record → mirror-row mapping. Server only.
//
// Env: MSDB_API_KEY (secret; sent as the `x-api-key` header, never logged),
//      MSDB_API_BASE (defaults to https://9exp-sec.com/api/ai).
//
// Used ONLY by lib/msdbSync.js — the picker search path reads the Studio DB
// mirror (lib/msdb.js), never this API. The mapping functions are exported so
// a later per-record upsert (e.g. MSDB webhooks) can reuse them.
//
// Endpoints (verified): /public-course, /online-course → { ok, total, page,
// limit, items }; /programs → { ok, summary, items }; /skills → { ok, items }.

import "server-only";

const DEFAULT_BASE = "https://9exp-sec.com/api/ai";
const TIMEOUT_MS = 8000;
const PAGE_LIMIT = 200;
const MAX_PAGES = 25;

/** Mirror kind → endpoint + the code/name fields. */
export const MSDB_API_SOURCES = {
  public_course: { path: "/public-course", code: "course_id", name: "course_name" },
  online_course: { path: "/online-course", code: "o_course_id", name: "o_course_name" },
  program: { path: "/programs", code: "program_id", name: "program_name" },
  skill: { path: "/skills", code: "skill_id", name: "skill_name" },
};

/** Thrown when the API can't be used (no key, 401, 5xx, timeout, bad JSON/shape). */
export class MsdbUnavailableError extends Error {}

async function getJson(path) {
  const key = process.env.MSDB_API_KEY;
  if (!key) throw new MsdbUnavailableError("MSDB_API_KEY is not set");
  const base = (process.env.MSDB_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");
  const where = path.split("?")[0];
  let res;
  try {
    res = await fetch(base + path, {
      headers: { "x-api-key": key, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new MsdbUnavailableError(`GET ${where}: ${err?.name === "TimeoutError" ? "timeout" : "network error"}`);
  }
  if (!res.ok) throw new MsdbUnavailableError(`GET ${where}: HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new MsdbUnavailableError(`GET ${where}: invalid JSON`);
  }
}

/** Every raw record of one list (follows `page`/`total` when paginated). */
export async function fetchMsdbList(kind) {
  const { path } = MSDB_API_SOURCES[kind];
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await getJson(`${path}?page=${page}&limit=${PAGE_LIMIT}`);
    const batch = Array.isArray(body?.items) ? body.items : null;
    if (!batch) throw new MsdbUnavailableError(`GET ${path}: unexpected response shape`);
    items.push(...batch);
    const total = Number(body?.total);
    if (!batch.length || !Number.isFinite(total) || items.length >= total) break;
  }
  return items;
}

const text = (v) => (v == null ? "" : String(v).trim());
/** Absolute http(s) URL or null (anything else is dropped). */
export function cleanIconUrl(v) {
  const s = text(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/** program _id and program_id → icon URL, from raw /programs records (or mirror rows). */
export function programIconIndex(programs) {
  const index = new Map();
  for (const p of programs) {
    const icon = cleanIconUrl(p.programiconurl ?? p.iconUrl);
    if (!icon) continue;
    for (const k of [p._id, p.program_id, p.msdbId, p.code]) if (k) index.set(String(k), icon);
  }
  return index;
}

/** A course's program: embedded object, or a bare id/code string. */
function programOf(doc) {
  const p = doc.program;
  if (!p) return { id: null, icon: null, keys: [] };
  if (typeof p === "object") {
    return { id: p._id ? String(p._id) : null, icon: cleanIconUrl(p.programiconurl), keys: [p._id, p.program_id].filter(Boolean).map(String) };
  }
  return { id: String(p), icon: null, keys: [String(p)] };
}

/**
 * One raw MSDB record → a mirror row (without syncedAt), or null when unusable.
 * @param {"public_course"|"online_course"|"program"|"skill"} kind
 * @param {object} doc
 * @param {{ programIcons?: Map<string, string> }} [ctx]
 */
export function toMsdbRef(kind, doc, { programIcons = new Map() } = {}) {
  const src = MSDB_API_SOURCES[kind];
  if (!src || !doc || !doc._id) return null;
  const code = text(doc[src.code]);
  const name = text(doc[src.name]);
  if (!name && !code) return null;

  let iconUrl = null;
  let programMsdbId = null;
  let isInhouse = false;
  if (kind === "program") iconUrl = cleanIconUrl(doc.programiconurl);
  else if (kind === "skill") iconUrl = cleanIconUrl(doc.skilliconurl);
  else {
    const prog = programOf(doc);
    programMsdbId = prog.id;
    iconUrl = prog.icon ?? prog.keys.map((k) => programIcons.get(k)).find(Boolean) ?? null;
    if (kind === "online_course") iconUrl ??= cleanIconUrl(doc.o_course_cover_url);
    // In-house-only classroom courses have course_type_public: false. They stay
    // active (pickable, badged "In-house"); `active` only tracks presence in MSDB.
    if (kind === "public_course") isInhouse = doc.course_type_public === false;
  }

  return {
    kind,
    msdbId: String(doc._id),
    code,
    name: name || code,
    iconUrl,
    programMsdbId,
    isInhouse,
    active: true, // present in this fetch; the sync deactivates rows that are missing
    searchText: `${code} ${name}`.toLowerCase(),
  };
}

/** A mirror row → bulkWrite upsert op. */
export const msdbRefUpsert = (ref, syncedAt) => ({
  updateOne: {
    filter: { kind: ref.kind, msdbId: ref.msdbId },
    update: { $set: { ...ref, syncedAt } },
    upsert: true,
  },
});
