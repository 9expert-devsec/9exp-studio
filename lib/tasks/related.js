// Task "Related" link — ONE optional item: a course (public/online) OR a program
// OR a skill from the MSDB mirror. Pure: shared by server code and the client.
//
// Stored on tasks as details.related:
//   { kind: "public_course" | "online_course" | "program" | "skill",
//     refId: "<MSDB _id>",
//     snapshot: { code, name, iconUrl, isInhouse } }
//
// Legacy tasks (before round 28) stored up to three snapshots instead:
//   details.relatedCourse ({ kind: "public" | "online", id, code, name, iconUrl? }),
//   details.relatedProgram, details.relatedSkill.
// normalizeRelated() maps both shapes to the new one; EVERY reader goes through
// it. Saving writes only `related` (the legacy keys are dropped with the rest of
// the old details object).

export const RELATED_KINDS = ["public_course", "online_course", "program", "skill"];

/** The Related Type segments → the mirror kinds each one lists. */
export const RELATED_TYPES = [
  { key: "course", label: "Course", kinds: ["public_course", "online_course"] },
  { key: "program", label: "Program", kinds: ["program"] },
  { key: "skill", label: "Skill", kinds: ["skill"] },
];

/** "public_course" → "course", … (null for unknown kinds). */
export const relatedTypeOf = (kind) => RELATED_TYPES.find((t) => t.kinds.includes(kind))?.key ?? null;

const LEGACY_KIND = { public: "public_course", online: "online_course", program: "program", skill: "skill" };
const LEGACY_FIELDS = ["relatedCourse", "relatedProgram", "relatedSkill"]; // course (public|online) → program → skill

const text = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** A stored/new-shape value → clean `{ kind, refId, snapshot }`, or null. */
function cleanRelated(r) {
  if (!r || typeof r !== "object" || !RELATED_KINDS.includes(r.kind) || !r.refId) return null;
  const s = r.snapshot ?? {};
  return {
    kind: r.kind,
    refId: text(r.refId),
    snapshot: { code: text(s.code), name: text(s.name), iconUrl: s.iconUrl ? text(s.iconUrl) : null, isInhouse: !!s.isInhouse },
  };
}

/** A legacy snapshot → new shape, or null when empty/unknown. */
function fromLegacy(snap) {
  if (!snap || typeof snap !== "object" || !snap.id || !LEGACY_KIND[snap.kind]) return null;
  return {
    kind: LEGACY_KIND[snap.kind],
    refId: text(snap.id),
    snapshot: { code: text(snap.code), name: text(snap.name), iconUrl: snap.iconUrl ? text(snap.iconUrl) : null, isInhouse: false },
  };
}

/**
 * Task details (either shape) → the one related item.
 * Legacy data keeps the FIRST non-empty of: public course → online course →
 * program → skill (the course slot held either a public or an online course).
 * @returns {{ related: { kind: string, refId: string, snapshot: object } | null, hadMultiple: boolean, legacy: boolean }}
 */
export function normalizeRelated(details) {
  const d = details && typeof details === "object" ? details : {};
  if ("related" in d) return { related: cleanRelated(d.related), hadMultiple: false, legacy: false };
  const items = LEGACY_FIELDS.map((f) => fromLegacy(d[f])).filter(Boolean);
  return { related: items[0] ?? null, hadMultiple: items.length > 1, legacy: items.length > 0 };
}

/** Badge text for a course item: "In-house" / "Public" / "Online" (null for programs/skills). */
export function relatedBadge(kind, isInhouse) {
  if (kind === "public_course") return isInhouse ? "In-house" : "Public";
  if (kind === "online_course") return "Online";
  return null;
}

/** New-shape item → the flat value the picker uses: { kind, refId, code, name, iconUrl, isInhouse }. */
export const relatedToPickerValue = (r) => (r ? { kind: r.kind, refId: r.refId, ...r.snapshot } : null);
