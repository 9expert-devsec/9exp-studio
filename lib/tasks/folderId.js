// Folder IDs — pure helpers (no DB): format `YYMM-NNN<suffix>`, e.g. 2611-011G.
//   YY/MM  the CREATION time in Asia/Bangkok (2-digit CE year, 2-digit month)
//   NNN    sequence, zero-padded to 3 digits (more digits past 999: 2611-1000G)
//   suffix one per kind of work (the map below)
// Sequences are separate per suffix per month (counter key `YYMM-<suffix>`).
// Issued once, on the server, when a task is created with "New Folder"; never
// reused. Several tasks may share one folder (lib/tasks/folders.js, round 36).
// DB side: lib/tasks/folderCounter.js.

/** Every suffix (one place). `taskType` = the task type that issues it; null = defined for later. */
export const FOLDER_ID_KINDS = [
  { key: "graphic", label: "Graphic", suffix: "G", taskType: "graphic" },
  { key: "long_clip", label: "Long Clip", suffix: "Y", taskType: null },
  { key: "short_clip", label: "Short Clip", suffix: "S", taskType: null },
  { key: "photo", label: "Photo", suffix: "P", taskType: "photo" },
  { key: "course_online", label: "Course Online", suffix: "CO", taskType: null },
];

/** Kinds that issue IDs today. */
export const issuingFolderKinds = () => FOLDER_ID_KINDS.filter((k) => k.taskType);

/** The suffix a task type issues, or null (that type gets no Folder ID). */
export const folderSuffixForType = (type) => FOLDER_ID_KINDS.find((k) => k.taskType && k.taskType === type)?.suffix ?? null;

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok is UTC+7 all year (no DST)

/** Date → "YYMM" of that instant in Asia/Bangkok. */
export function bangkokYYMM(date = new Date()) {
  const d = new Date(new Date(date).getTime() + BKK_OFFSET_MS);
  const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

/** "2611" + "G" → the counter key "2611-G". */
export const folderCounterKey = (yymm, suffix) => `${yymm}-${suffix}`;

/** ("2611", 11, "G") → "2611-011G". */
export function formatFolderId(yymm, seq, suffix) {
  return `${yymm}-${String(seq).padStart(3, "0")}${suffix}`;
}

/** "2611-011G" → { yymm: "2611", seq: 11, suffix: "G" }, or null. */
export function parseFolderId(id) {
  const m = /^(\d{4})-(\d{3,})([A-Z]{1,3})$/.exec(String(id ?? ""));
  return m ? { yymm: m[1], seq: Number(m[2]), suffix: m[3] } : null;
}

/** Anchored pattern for IDs of one month + suffix (sequence captured). */
export const folderIdPattern = (yymm, suffix) => new RegExp(`^${yymm}-(\\d{3,})${suffix}$`);
