// Small shared project UI (no hooks: renders from server and client components).

import Avatar from "@/components/ui/Avatar";
import { projectIcon } from "@/lib/projects/icons";
import { statusInfo } from "@/lib/projects/status";

const TILE = {
  lg: { box: "size-24 rounded-[24px]", icon: "size-11" },
  md: { box: "size-14 rounded-[16px]", icon: "size-[26px]" },
  base: { box: "size-12 rounded-[14px]", icon: "size-6" },
  sm: { box: "size-10 rounded-[12px]", icon: "size-5" },
};

/**
 * Rounded-square icon tile. Colour is a runtime hex from the registry, so it is
 * applied with inline style (stroke = colour, background = same colour at 10%).
 * `as` swaps the glyph but keeps the project's colour (e.g. FileText for content).
 */
export function ProjectIconTile({ icon, as, size = "sm", className = "" }) {
  const { component, color } = projectIcon(icon);
  const Icon = as ?? component;
  const t = TILE[size] ?? TILE.sm;
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${t.box} ${className}`}
      style={{ backgroundColor: `${color}1A`, color }}
    >
      <Icon className={t.icon} strokeWidth={1.75} />
    </span>
  );
}

export function StatusDot({ status, className = "" }) {
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${statusInfo(status).dot} ${className}`} />;
}

/**
 * Chip with dot and the status name ("Open", "In progress", …). Tasks pass their
 * status GROUP as `status` (colour) and the catalog's Thai label as `label`.
 */
export function StatusChip({ status, label }) {
  const s = statusInfo(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${s.chip}`}>
      <StatusDot status={status} />
      {label ?? s.label}
    </span>
  );
}

export function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-control-line bg-control px-2.5 py-1 text-xs font-medium text-fg ${className}`}>
      {children}
    </span>
  );
}

const TRACK = { neutral: "bg-track", accent: "bg-accent-soft" };

/** Thin rounded progress bar: accent fill on the track token (tone="accent": light-accent track). */
export function ProgressBar({ value = 0, label, tone = "neutral", className = "" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label ?? "Project progress"}
      className={`h-1.5 w-full overflow-hidden rounded-full ${TRACK[tone] ?? TRACK.neutral} ${className}`}
    >
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Up to `max` avatars, then a "+N" pill. */
export function AvatarStack({ people = [], max = 3, size = 24 }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      <ul className="flex items-center -space-x-1.5" aria-label={`${people.length} ${people.length === 1 ? "person" : "people"}`}>
        {shown.map((p) => (
          <li key={p.id} title={p.name} className="rounded-full ring-2 ring-card">
            <Avatar name={p.name} url={p.avatarUrl} size={size} />
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <span className="ml-1.5 rounded-full bg-track px-1.5 py-0.5 text-[11px] font-semibold text-fg-muted">+{rest}</span>
      )}
    </div>
  );
}

export const metaLine = (p) =>
  `${p.memberCount} ${p.memberCount === 1 ? "Member" : "Members"} · ${p.files} ${p.files === 1 ? "File" : "Files"}`;
