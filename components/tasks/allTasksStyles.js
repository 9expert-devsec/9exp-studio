// All Tasks (round 56): class strings shared by the real toolbar / table (client)
// and the first-visit skeleton (server). Plain module, so server components get
// real strings (a "use client" module's non-component exports are references).

/** Every toolbar control's height (search, ตัวกรอง, จัดกลุ่ม). */
export const TOOLBAR_H = "h-10";
/** The table header row. */
export const TABLE_HEAD = "h-11";
/** A task row: two text lines + the status bar (skeleton rows use it as a fixed height). */
export const ROW_SKELETON_H = "h-[73px]";
/** Column widths (colgroup); Task takes the rest. */
export const COL = { status: "w-[220px]", person: "w-[200px]", due: "w-[120px]" };
