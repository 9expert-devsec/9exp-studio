// MSDB master data via the 9Expert MSDB AI API — READ-ONLY (GET only). Server only.
//
// Env: MSDB_API_KEY (secret; sent as the `x-api-key` header, never logged),
//      MSDB_API_BASE (defaults to https://9exp-sec.com/api/ai).
//
// The API has no free-text search for courses/programs/skills, so each FULL
// list is fetched server-side and kept in an in-memory TTL cache (10 min,
// per server instance; concurrent callers share one in-flight request).
// Searching filters the cached list locally. A failed fetch is never cached.
//
// Endpoints (verified): /public-course, /online-course → { ok, total, page,
// limit, items }; /programs → { ok, summary, items }; /skills → { ok, items }.

import "server-only";

const DEFAULT_BASE = "https://9exp-sec.com/api/ai";
const TTL_MS = 10 * 60 * 1000;
const MIN_REFRESH_MS = 60 * 1000;
const TIMEOUT_MS = 8000;
const PAGE_LIMIT = 200;
const MAX_PAGES = 25;
const MAX_RESULTS = 20;

/** kind → endpoint + the code/name fields used. `usable` = only pickable records. */
export const MSDB_SOURCES = {
  // Public (classroom) courses; in-house-only records have course_type_public: false.
  public: { path: "/public-course", code: "course_id", name: "course_name", usable: (d) => d.course_type_public !== false },
  online: { path: "/online-course", code: "o_course_id", name: "o_course_name", usable: () => true },
  program: { path: "/programs", code: "program_id", name: "program_name", usable: () => true },
  skill: { path: "/skills", code: "skill_id", name: "skill_name", usable: () => true },
};
export const COURSE_KINDS = ["public", "online"];

/** Thrown when the API can't be used (no key, 401, 5xx, timeout, bad JSON). */
export class MsdbUnavailableError extends Error {}

let cache = globalThis._msdbApi;
if (!cache) cache = globalThis._msdbApi = new Map(); // kind → { at, items } | { promise }

async function getJson(path) {
  const key = process.env.MSDB_API_KEY;
  if (!key) {
    console.error("[msdb] MSDB_API_KEY is not set.");
    throw new MsdbUnavailableError("not configured");
  }
  const base = (process.env.MSDB_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");
  let res;
  try {
    res = await fetch(base + path, {
      headers: { "x-api-key": key, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[msdb] GET ${path.split("?")[0]} failed: ${err?.name === "TimeoutError" ? "timeout" : err?.name || "network error"}`);
    throw new MsdbUnavailableError("request failed");
  }
  if (!res.ok) {
    console.error(`[msdb] GET ${path.split("?")[0]} failed: HTTP ${res.status}`);
    throw new MsdbUnavailableError(`HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    console.error(`[msdb] GET ${path.split("?")[0]} failed: invalid JSON`);
    throw new MsdbUnavailableError("invalid JSON");
  }
}

/** Every item of a list endpoint, following `page`/`total` when paginated. */
async function fetchAll(kind) {
  const { path } = MSDB_SOURCES[kind];
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await getJson(`${path}?page=${page}&limit=${PAGE_LIMIT}`);
    const batch = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : null;
    if (!batch) {
      console.error(`[msdb] GET ${path} failed: unexpected response shape`);
      throw new MsdbUnavailableError("unexpected shape");
    }
    items.push(...batch);
    const total = Number(body?.total);
    if (!batch.length || !Number.isFinite(total) || items.length >= total) break;
  }
  return items;
}

/** The cached list for `kind` (fresh fetch when stale, missing, or `force`). */
async function listFor(kind, { force = false } = {}) {
  const entry = cache.get(kind);
  if (entry?.promise) return entry.promise;
  const age = entry ? Date.now() - entry.at : Infinity;
  // A forced refresh (snapshot miss) runs at most once a minute per list.
  if (entry && age < (force ? MIN_REFRESH_MS : TTL_MS)) return entry.items;
  const promise = fetchAll(kind)
    .then((raw) => {
      const src = MSDB_SOURCES[kind];
      const items = raw.filter((d) => d && d._id && src.usable(d)).map((d) => toSnapshot(kind, d));
      cache.set(kind, { at: Date.now(), items });
      return items;
    })
    .catch((err) => {
      // Keep serving the previous list (if any) rather than caching the failure.
      if (entry?.items) cache.set(kind, entry);
      else cache.delete(kind);
      throw err;
    });
  cache.set(kind, { promise });
  return promise;
}

/** A record → the snapshot stored on tasks: { source, kind, id, code, name }. */
function toSnapshot(kind, doc) {
  const src = MSDB_SOURCES[kind];
  return {
    source: "msdb",
    kind,
    id: String(doc._id),
    code: String(doc[src.code] ?? ""),
    name: String(doc[src.name] ?? ""),
  };
}

async function search(kind, q) {
  const term = String(q ?? "").trim().slice(0, 100).toLowerCase();
  const items = await listFor(kind);
  const hits = term
    ? items.filter((s) => s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term))
    : items;
  return [...hits].sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_RESULTS);
}

/** @param {{ q: string, kind: "public" | "online" }} args */
export const searchCourses = ({ q, kind }) => search(COURSE_KINDS.includes(kind) ? kind : "public", q);
export const searchPrograms = (q) => search("program", q);
export const searchSkills = (q) => search("skill", q);

/** One record by id as a snapshot, or null (unknown kind / bad id / not found). Refetches once on a miss. */
export async function getMsdbSnapshot(kind, id) {
  if (!MSDB_SOURCES[kind] || typeof id !== "string" || !id) return null;
  const find = (items) => items.find((s) => s.id === id) ?? null;
  const hit = find(await listFor(kind));
  if (hit) return hit;
  return find(await listFor(kind, { force: true }));
}
