// Task activity — pure before/after diff for the Edit action (no DB). Shared by
// the server (lib/tasks/activity.js) and node checks.
//
// diffTask(before, after) compares two task snapshots ({ title, startAt, dueAt,
// assignee, details }) and returns what to log:
//   updatedFields  labels of changed plain fields (title, dates, details …);
//                  [] → no "updated" entry
//   assignee       { from, to } ids, or null
//   reviewers      [{ role, from, to }] (content / video / design review)
//   assets         { added, removed } counts for details.relatedAssets, or null
// People and assets are NOT in updatedFields (they get their own entries).
// Values are compared normalised (ObjectId/Date → string; Related by kind + id;
// the legacy relatedCourse/Program/Skill keys count as "Related").

const FIELD_LABELS = {
  title: "Title",
  startAt: "Start date",
  dueAt: "Due date",
  videoType: "Video Type",
  platforms: "Platforms",
  platform: "Platform",
  workType: "Work Type",
  items: "Items",
  fileLocation: "File Location",
  photos: "Photos",
  brief: "Brief",
  editingRequirements: "Editing Requirements",
  referenceUrl: "Reference",
  related: "Related",
  workLevel: "Work Level",
  articleType: "Article Type",
};
/** Per-type label overrides (same stored field, different name in that type's form). */
const TYPE_LABELS = { post: { workType: "Post Type", dueAt: "Schedule Post" } };

const PEOPLE = { contentReviewer: "Content review", videoReviewer: "Video review", designReviewer: "Design review" };
const LEGACY_RELATED = ["relatedCourse", "relatedProgram", "relatedSkill"];

/** Stable comparable form: ids/dates → strings, objects with sorted keys. */
function norm(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && typeof v.toHexString === "function") return v.toHexString();
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v === "object") {
    if (v._bsontype === "ObjectId" || v._bsontype === "ObjectID") return String(v);
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])]));
  }
  return v;
}
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const idOrNull = (v) => (v ? String(norm(v)) : null);

/** Related compared by identity only (snapshots refresh); legacy keys fold into it. */
function relatedKey(details) {
  const d = details ?? {};
  if (d.related) return `${d.related.kind}:${d.related.refId}`;
  const legacy = LEGACY_RELATED.map((k) => d[k]).find((x) => x && x.id);
  return legacy ? `legacy:${legacy.id}` : null;
}

/**
 * @param {{ title?: string, startAt?: unknown, dueAt?: unknown, assignee?: unknown, details?: object }} before
 * @param {{ title?: string, startAt?: unknown, dueAt?: unknown, assignee?: unknown, details?: object }} after
 * @param {string} [type] task type (label overrides)
 */
export function diffTask(before, after, type = "") {
  const label = (k) => TYPE_LABELS[type]?.[k] ?? FIELD_LABELS[k] ?? k;
  const updatedFields = [];

  for (const k of ["title", "startAt", "dueAt"]) if (!same(before?.[k], after?.[k])) updatedFields.push(label(k));

  const bd = before?.details ?? {};
  const ad = after?.details ?? {};
  const skip = new Set(["related", "relatedAssets", ...Object.keys(PEOPLE), ...LEGACY_RELATED]);
  const keys = [...new Set([...Object.keys(bd), ...Object.keys(ad)])].filter((k) => !skip.has(k));
  for (const k of keys) if (!same(bd[k], ad[k])) updatedFields.push(label(k));
  if (relatedKey(bd) !== relatedKey(ad)) updatedFields.push(label("related"));

  const assignee = same(before?.assignee, after?.assignee) ? null : { from: idOrNull(before?.assignee), to: idOrNull(after?.assignee) };

  const reviewers = Object.entries(PEOPLE)
    .filter(([k]) => !same(bd[k], ad[k]))
    .map(([k, role]) => ({ role, from: idOrNull(bd[k]), to: idOrNull(ad[k]) }));

  let assets = null;
  if ("relatedAssets" in bd || "relatedAssets" in ad) {
    const b = new Set((bd.relatedAssets ?? []).map((x) => String(norm(x))));
    const a = new Set((ad.relatedAssets ?? []).map((x) => String(norm(x))));
    const added = [...a].filter((x) => !b.has(x)).length;
    const removed = [...b].filter((x) => !a.has(x)).length;
    if (added || removed) assets = { added, removed };
  }

  return { updatedFields, assignee, reviewers, assets };
}
