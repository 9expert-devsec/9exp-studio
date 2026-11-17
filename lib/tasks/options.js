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
 * Platform marks: simple coloured marks (no third-party logo files). `color` is a
 * runtime value, applied with inline style by <PlatformMark>.
 */
export const PLATFORM_MARKS = [
  { key: "youtube", label: "YouTube", color: "#FF0000", glyph: "▶" },
  { key: "facebook", label: "Facebook", color: "#1877F2", glyph: "f" },
  { key: "tiktok", label: "TikTok", color: "#111111", glyph: "♪" },
  { key: "instagram", label: "Instagram", color: "#E1306C", glyph: "◎" },
  { key: "line", label: "LINE", color: "#06C755", glyph: "L" },
  { key: "x", label: "X", color: "#000000", glyph: "X" },
  { key: "website", label: "Website", color: "#2486FF", glyph: "◍" },
  { key: "other", label: "Other", color: "#617185", glyph: "•" },
];
export const PLATFORM_MARK_KEYS = PLATFORM_MARKS.map((m) => m.key);
export const platformMark = (key) => PLATFORM_MARKS.find((m) => m.key === key) ?? PLATFORM_MARKS.at(-1);
