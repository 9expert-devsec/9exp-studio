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
