// Project date display. Dates are date-only (UTC midnight), so format in UTC.

const md = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const mdy = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const yearOf = (d) => new Date(d).getUTCFullYear();

/** "Jun 1, 2026", or "—" when missing. */
export function formatProjectDate(value) {
  return value ? mdy.format(new Date(value)) : "—";
}

/** "Jun 12" (task due dates). */
export function formatShortDate(value) {
  return value ? md.format(new Date(value)) : "";
}

/**
 * THE project date label (header, table, Project info). Both dates are optional:
 *   both  → "Jun 1 – Jun 30, 2026" ("Dec 1, 2026 – Jan 5, 2027" across years)
 *   start → "From Jun 1, 2026"
 *   end   → "Until Jun 30, 2026"
 *   none  → "" (header hides the date; table/info rows show "—")
 */
export function projectDateLabel({ startDate, endDate }) {
  if (startDate && endDate) {
    if (yearOf(startDate) === yearOf(endDate)) return `${md.format(new Date(startDate))} – ${mdy.format(new Date(endDate))}`;
    return `${formatProjectDate(startDate)} – ${formatProjectDate(endDate)}`;
  }
  if (startDate) return `From ${formatProjectDate(startDate)}`;
  if (endDate) return `Until ${formatProjectDate(endDate)}`;
  return "";
}

const bkk = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Bangkok",
});

/** Timestamp → "June 15, 2026 14:20" (Asia/Bangkok, 24h), or "—". */
export function formatUpdatedAt(value) {
  if (!value) return "—";
  const p = Object.fromEntries(bkk.formatToParts(new Date(value)).map((x) => [x.type, x.value]));
  return `${p.month} ${p.day}, ${p.year} ${p.hour}:${p.minute}`;
}

const bkkShort = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Bangkok",
});

/** Datetime → "Jun 12, 2026 · 14:00" (Asia/Bangkok, 24h), or "" when missing. */
export function formatTaskDateTime(value) {
  if (!value) return "";
  const p = Object.fromEntries(bkkShort.formatToParts(new Date(value)).map((x) => [x.type, x.value]));
  return `${p.month} ${p.day}, ${p.year} · ${p.hour}:${p.minute}`;
}

const thaiShort = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Bangkok",
});

/** Datetime → "28 พ.ย. 69 11:00" (Bangkok, Buddhist year), or "". Review cards (round 46). */
export function formatThaiDateTime(value) {
  if (!value) return "";
  const p = Object.fromEntries(thaiShort.formatToParts(new Date(value)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`;
}

// Date-only Thai labels for a calendar day "YYYY-MM-DD" (round 47 Work Plan): the
// same th-TH (Buddhist year, 2 digits) as formatThaiDateTime. The day is read at
// UTC noon and printed in UTC, so it never shifts across a time zone.
// Round 47.1: the weekday comes from a FIXED table ("อ.", "พฤ.") — browsers' own
// th-TH data may print full names ("อังคาร") for weekday "short".
const thaiDayParts = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
const THAI_WEEKDAY = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/** "2026-11-18" → "พ. 18 พ.ย." (weekday), "18 พ.ย." (weekday: false), "+ 69" with year. "" when invalid. */
export function formatThaiDay(dateStr, { weekday = true, year = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  const p = Object.fromEntries(thaiDayParts.formatToParts(d).map((x) => [x.type, x.value]));
  return [weekday ? THAI_WEEKDAY[d.getUTCDay()] : "", `${p.day} ${p.month}`, year ? p.year : ""].filter(Boolean).join(" ");
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Datetime → "10 minutes ago", "yesterday", "3 days ago" (vs `now`), or "". */
export function relativeTimeLabel(value, now = Date.now()) {
  if (!value) return "";
  const secs = Math.round((new Date(value).getTime() - now) / 1000);
  const steps = [
    [60, "second", 1],
    [3600, "minute", 60],
    [86400, "hour", 3600],
    [86400 * 30, "day", 86400],
    [86400 * 365, "month", 86400 * 30],
    [Infinity, "year", 86400 * 365],
  ];
  for (const [limit, unit, div] of steps) {
    if (Math.abs(secs) < limit) return relative.format(Math.round(secs / div), unit);
  }
  return "";
}

/** Brief URL →"docs.google.com/document/d/…" (hostname + path, no trailing "/"). */
export function briefLabel(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url;
  }
}

/** Every project is a Campaign (legacy "ongoing" documents included). */
export const PROJECT_TYPE_LABEL = "Campaign";

/** Content sequence number → "01", "02", … */
export const contentNumberLabel = (n) => String(n).padStart(2, "0");
