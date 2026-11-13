// Project date display. Dates are date-only (UTC midnight), so format in UTC.

const md = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const mdy = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const yearOf = (d) => new Date(d).getUTCFullYear();

/** "Jun 1, 2026" */
export function formatProjectDate(value) {
  return value ? mdy.format(new Date(value)) : "—";
}

/** "Jun 1 – Jun 30, 2026", or "Dec 1, 2026 – Jan 5, 2027" across years. */
export function formatDateRange(start, end) {
  if (!start) return "—";
  if (!end) return formatProjectDate(start);
  if (yearOf(start) === yearOf(end)) return `${md.format(new Date(start))} – ${mdy.format(new Date(end))}`;
  return `${formatProjectDate(start)} – ${formatProjectDate(end)}`;
}

/** Card/table dates: campaign = range, ongoing = start date. */
export function projectDates(project) {
  return project.type === "campaign"
    ? formatDateRange(project.startDate, project.endDate)
    : formatProjectDate(project.startDate);
}

/** Detail header: campaign = range, ongoing = "Since Jun 1, 2026". */
export function projectDatesLong(project) {
  return project.type === "campaign"
    ? formatDateRange(project.startDate, project.endDate)
    : `Since ${formatProjectDate(project.startDate)}`;
}

export const TYPE_LABEL = { ongoing: "Ongoing", campaign: "Campaign" };
