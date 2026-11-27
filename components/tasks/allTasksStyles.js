// All Tasks (rounds 56–57): class strings shared by the real toolbar / table /
// calendar (client) and the first-visit skeleton (server). Plain module, so server
// components get real strings (a "use client" module's non-component exports are
// references).

/** Every toolbar control's height (search, ตัวกรอง, จัดกลุ่ม). */
export const TOOLBAR_H = "h-10";
/** The table header row. */
export const TABLE_HEAD = "h-11";
/** A task row: two text lines + the status bar (skeleton rows use it as a fixed height). */
export const ROW_SKELETON_H = "h-[73px]";
/** Column widths (colgroup); Task takes the rest. */
export const COL = { status: "w-[220px]", person: "w-[200px]", due: "w-[120px]" };

// ── Round 57: the card scrolls inside itself (lg+, pinned shell) ───────────────
/** Everything under the toolbar: fills the rest of the viewport (card + legend). */
export const BODY = "flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:pb-[26px]";
/** The table / calendar card: takes the BODY's free height; its parts are rows. */
export const CARD_FILL = "flex flex-col overflow-hidden lg:min-h-0 lg:flex-1";
/** The scroll area INSIDE the card (thin themed scrollbar inside the frame). */
export const SCROLLER = "app-scrollbar min-h-0 flex-1 overflow-auto overscroll-contain";
/** A sticky header row: opaque in both themes + a subtle bottom line. */
export const STICKY_HEAD = "sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--ds-line)]";
