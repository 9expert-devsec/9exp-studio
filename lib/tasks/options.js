// Admin-managed option lists (models/TaskOption.js): which lists exist, and the
// fixed platform "brand mark" set. Pure: shared by the model, server code and the
// client. Adding a list is one entry here; no schema change.
//
// Work Type is ONE list shared by Graphic and Post tasks. Work/Article/Photo Type
// start empty and aren't used by any task yet (their Step 2 forms come later).

export const TASK_OPTION_LISTS = [
  { key: "video_type", label: "Video Type", hasIcon: false },
  { key: "platform", label: "Platform", hasIcon: true },
  // hasPlatforms: each option links to ≥ 1 platform option (TaskOption.platforms).
  { key: "work_type", label: "Work Type", hasIcon: false, hasPlatforms: true },
  { key: "article_type", label: "Article Type", hasIcon: false },
  { key: "photo_type", label: "Photo Type", hasIcon: false },
];
export const TASK_OPTION_LIST_KEYS = TASK_OPTION_LISTS.map((l) => l.key);
export const getOptionList = (key) => TASK_OPTION_LISTS.find((l) => l.key === key) ?? null;

export const TASK_OPTION_LABEL_MAX = 60;

/**
 * Platform icon keys — stored on TaskOption.icon (keep these keys stable). The
 * logo + colour for each key lives in components/tasks/PlatformIcon.jsx.
 */
export const PLATFORM_MARKS = [
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "line", label: "LINE" },
  { key: "x", label: "X" },
  { key: "shopee", label: "Shopee" },
  { key: "internal", label: "Internal" },
  { key: "website", label: "Website" },
  { key: "other", label: "Other" },
];
export const PLATFORM_MARK_KEYS = PLATFORM_MARKS.map((m) => m.key);

/** Most platforms one work type may link to (sanity cap). */
export const WORK_TYPE_PLATFORMS_MAX = 50;

/**
 * Pure: the ACTIVE work types linked to ANY of `platformIds`, in list order
 * (order, then label), each once. Unlinked or inactive work types never appear.
 * @param {Array<{ _id: unknown, active?: boolean, order?: number, label?: string, platforms?: unknown[] }>} workTypes
 * @param {unknown[]} platformIds
 */
export function selectWorkTypesForPlatforms(workTypes, platformIds) {
  const wanted = new Set((platformIds ?? []).map(String));
  if (!wanted.size) return [];
  const seen = new Set();
  return workTypes
    .filter((w) => w.active && (w.platforms ?? []).some((p) => wanted.has(String(p))))
    .filter((w) => !seen.has(String(w._id)) && seen.add(String(w._id)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.label ?? "").localeCompare(String(b.label ?? "")));
}
