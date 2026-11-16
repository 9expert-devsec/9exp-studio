// Project field rules (pure; shared by the model, server validation and the form).

export const PROJECT_NAME_MAX = 120;
export const PROJECT_DESCRIPTION_MAX = 2000;
export const PROJECT_MEMBERS_MAX = 100;
export const PROJECT_PIN_MAX = 2;

// Every project is a Campaign now. "ongoing" stays in the schema enum only so
// legacy documents still load; it is never written (normalised on read, and
// replaced with "campaign" the next time the project is saved).
export const PROJECT_TYPE = "campaign";
export const PROJECT_TYPES_STORED = ["ongoing", "campaign"];

export const CONTENT_NAME_MAX = 160;
export const CONTENT_DESCRIPTION_MAX = 2000;
export const PROJECT_STATUSES = ["open", "in_progress", "completed", "cancelled"];

export const PROJECT_ICON_KEYS = [
  "film",
  "clapperboard",
  "calendar-days",
  "folder",
  "presentation",
  "audio-lines",
  "megaphone",
  "palette",
  "graduation-cap",
  "monitor-play",
  "video",
];
export const DEFAULT_PROJECT_ICON = "folder";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → Date at UTC midnight, or null when missing/invalid (e.g. 2026-02-30). */
export function parseDateOnly(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

/** Date → "YYYY-MM-DD" (UTC), for <input type="date">. */
export function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Escape user text for a literal, case-insensitive Mongo $regex. */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** http(s) URL check for brief links (projects and content). */
export function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
