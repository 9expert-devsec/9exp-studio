// Admin-managed option lists (models/TaskOption.js): which lists exist, and the
// fixed platform "brand mark" set. Pure: shared by the model, server code and the
// client. Adding a list is one entry here; no schema change.
//
// Work Type is ONE list shared by Graphic and Post tasks. Work/Article/Photo Type
// start empty and aren't used by any task yet (their Step 2 forms come later).

export const TASK_OPTION_LISTS = [
  { key: "video_type", label: "Video Type", hasIcon: false },
  { key: "platform", label: "Platform", hasIcon: true },
  { key: "work_type", label: "Work Type", hasIcon: false },
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
  { key: "website", label: "Website" },
  { key: "other", label: "Other" },
];
export const PLATFORM_MARK_KEYS = PLATFORM_MARKS.map((m) => m.key);
