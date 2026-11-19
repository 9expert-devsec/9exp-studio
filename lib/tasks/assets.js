// Post "Related Assets" — pure helpers (no DB), shared by the server (validation,
// read models) and the Post Step 2 form.
//
// A Post links up to 20 other tasks (Clip, Graphic, Photo, Article) from ANY
// project; it stores ids only (details.relatedAssets) and reads live data at
// display time. Its Status Asset is DERIVED from those tasks, never set by hand.

import { ASSET_TASK_TYPES, ASSET_TASK_TYPE_KEYS, assetStatusLabel } from "./types.js";

export const RELATED_ASSETS_MAX = 20;

/**
 * Derived Status Asset key for a post from its linked tasks [{ type, status }]:
 *   cancelled assets are ignored;
 *   none left → "not_needed" · all done → "ready" · some done → "partial" · none done → "not_ready".
 */
export function deriveAssetStatus(assetTasks) {
  const rules = (t) => ASSET_TASK_TYPES[t?.type];
  const live = (assetTasks ?? []).filter((t) => rules(t) && !rules(t).cancelled.includes(t.status));
  if (live.length === 0) return "not_needed";
  const done = live.filter((t) => rules(t).done.includes(t.status)).length;
  if (done === live.length) return "ready";
  return done > 0 ? "partial" : "not_ready";
}

/** Thai label of the derived status (the post type's assetStatuses catalog). */
export const derivedAssetStatusLabel = (assetTasks) => assetStatusLabel("post", deriveAssetStatus(assetTasks));

/** Posted value → id strings (accepts ids or { id } rows from the form). */
export const relatedAssetIds = (raw) =>
  Array.isArray(raw) ? raw.map((x) => (typeof x === "string" ? x : typeof x?.id === "string" ? x.id : "")) : null;

/**
 * Validate a Post's Related Assets.
 * @param {unknown} raw            posted list (ids or { id } rows)
 * @param {{ selfId?: string | null, typeById: Map<string, string> }} ctx
 *   typeById: id → type of every EXISTING task among the posted ids (from the DB)
 * @returns {{ ok: true, ids: string[] } | { ok: false, error: string }}
 */
export function validateRelatedAssets(raw, { selfId = null, typeById }) {
  if (raw == null) return { ok: true, ids: [] };
  const ids = relatedAssetIds(raw);
  if (!ids || ids.some((id) => !/^[a-f0-9]{24}$/i.test(id))) return { ok: false, error: "Choose assets from the list." };
  if (new Set(ids).size !== ids.length) return { ok: false, error: "An asset is listed twice." };
  if (ids.length > RELATED_ASSETS_MAX) return { ok: false, error: `Link at most ${RELATED_ASSETS_MAX} assets.` };
  if (selfId && ids.includes(String(selfId))) return { ok: false, error: "A task can't be its own asset." };
  for (const id of ids) {
    const type = typeById.get(id);
    if (!type) return { ok: false, error: "One of the assets no longer exists. Remove it and try again." };
    if (!ASSET_TASK_TYPE_KEYS.includes(type)) return { ok: false, error: "Only Clip, Graphic, Photo or Article tasks can be assets." };
  }
  return { ok: true, ids };
}
