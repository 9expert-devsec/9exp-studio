// Round 55: class strings shared by the project top section (header card + tab bar)
// and its first-entry skeleton (Skeletons.jsx → ProjectTopSkeleton), so the two can
// never drift apart in height. Plain module (no "use client"): the (tabs) layout and
// other server components import these as real strings.

/** The project pages' in-app scroll container (round 52, the (tabs) layout). */
export const PROJECT_SCROLL_ID = "project-scroll";

// ── Header card (components/projects/ProjectHeaderCard.jsx) ──────────────────────
// Height is fixed by construction at lg: the 96px icon tile (TILE.lg) is taller
// than the text column, and the name is clamped to ONE line (truncate), so a long
// name or a missing date never changes the card height.
export const HEADER_CARD_PAD = "p-5 sm:p-6";
export const HEADER_ROW = "flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between";
export const HEADER_LEFT = "flex min-w-0 gap-4 sm:gap-5";
export const HEADER_TEXT = "min-w-0";
export const HEADER_LABEL = "text-[11px] font-semibold uppercase tracking-wider text-fg-muted";
export const HEADER_NAME = "mt-1 truncate text-2xl font-bold leading-tight text-fg sm:text-[28px]";
export const HEADER_META = "mt-3 flex flex-wrap items-center gap-2";
export const HEADER_ACTIONS = "flex shrink-0 flex-wrap items-center gap-2";

// ── Tab bar (components/projects/ProjectSectionNav.jsx) ──────────────────────────
export const TAB_NAV = "border-b border-line";
export const TAB_LIST = "-mb-px flex gap-1";
export const TAB_BASE = "inline-flex min-h-11 items-center border-b-2 px-4 text-sm";
export const TAB_IDLE_COLOR = "border-transparent font-medium text-fg-muted";
