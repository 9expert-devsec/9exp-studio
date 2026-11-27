// Post "Related Assets" — pure helpers (no DB), shared by the server (validation,
// read models) and the Post Step 2 form.
//
// A Post links up to 20 other tasks (Clip, Graphic, Photo, Article) from ANY
// project; it stores ids only (details.relatedAssets) and reads live data at
// display time. Its Status Asset is DERIVED from those tasks, never set by hand.

import { ASSET_TASK_TYPES, ASSET_TASK_TYPE_KEYS, assetStatusLabel, canonicalStatus } from "./types.js";

export const RELATED_ASSETS_MAX = 20;

/**
 * Is ONE linked task ready? (round 49) "ready" = its type's FINAL status (Clip /
 * Graphic เสร็จสมบูรณ์ · Photo พร้อมใช้งาน · Article เผยแพร่แล้ว); "ignored" =
 * cancelled (or not an asset type); else "pending". Legacy keys count as their
 * replacement (round 40).
 */
export function assetState(t) {
  const rules = ASSET_TASK_TYPES[t?.type];
  if (!rules) return "ignored";
  const key = canonicalStatus(t.type, t.status);
  if (rules.cancelled.includes(key)) return "ignored";
  return rules.done.includes(key) ? "ready" : "pending";
}

/**
 * THE readiness of a task's asset list (round 49) — used by the Post Status
 * Asset, the Article / Post status flow and the System re-check alike.
 * @param {{ type: string, status: string, title?: string }[]} assetTasks the linked tasks that still exist
 * @returns {{ total: number, ready: number, pending: object[], allReady: boolean, pendingNames: string[] }}
 *   total = non-cancelled assets; allReady is true when none is pending (also for none at all)
 */
export function assetReadiness(assetTasks) {
  const live = (assetTasks ?? []).filter((t) => assetState(t) !== "ignored");
  const pending = live.filter((t) => assetState(t) === "pending");
  return {
    total: live.length,
    ready: live.length - pending.length,
    pending,
    allReady: pending.length === 0,
    pendingNames: pending.map((t) => t.title ?? ""),
  };
}

/**
 * Derived Status Asset key for a post from its linked tasks [{ type, status }]
 * (computed from assetReadiness):
 *   cancelled assets are ignored;
 *   none left → "not_needed" · all done → "ready" · some done → "partial" · none done → "not_ready".
 */
export function deriveAssetStatus(assetTasks) {
  const r = assetReadiness(assetTasks);
  if (r.total === 0) return "not_needed";
  if (r.allReady) return "ready";
  return r.ready > 0 ? "partial" : "not_ready";
}

/** Leaving the draft step (Article "ร่างเสร็จ" / Post "แผนงานครบถ้วน"): รอชิ้นงาน while anything is pending, else รอเผยแพร่. */
export const draftExitTarget = (readiness) => (readiness.allReady ? "scheduled" : "waiting_assets");

/** The System move out of รอชิ้นงาน: "scheduled" once nothing is pending (or no assets are left), else null. Never backwards. */
export const autoAssetMove = (status, readiness) => (status === "waiting_assets" && readiness.allReady ? "scheduled" : null);

/** Article / Post: the types whose flow waits on Related Assets. */
export const ASSET_FLOW_TYPES = ["article", "post"];

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
