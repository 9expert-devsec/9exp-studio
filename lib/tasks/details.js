// Type-specific task details ("Step 2"): validation per type. Server only.
//
// TASK_DETAILS maps every task type to its parser, or null = "details not
// available yet" (the drawer keeps "Add details" disabled for those types).
// A parser takes the posted plain object and returns
//   { values: { details, assignee, startAt, dueAt } }  or  { errors: { field: msg } }
// Everything is re-validated here, including eligibility (assignee + reviewers,
// via access.js taskEligibility) and MSDB snapshots (re-read by id, never trusted
// from the client). Rich text is sanitised here (sanitize-html allowlist).

import "server-only";
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";
import { taskEligibility } from "@/lib/projects/access";
import { isHttpUrl, parseBangkokDateTime } from "@/lib/projects/rules";
import { getRelatedRef } from "@/lib/msdb";
import { RELATED_KINDS, normalizeRelated } from "@/lib/tasks/related";
import { TASK_TYPE_KEYS, WORK_LEVEL_KEYS } from "@/lib/tasks/types";
import TaskOption from "@/models/TaskOption";

export const FILE_LOCATION_MAX = 1000;
export const EDITING_REQUIREMENTS_MAX = 10000;
const REFERENCE_URL_MAX = 2000;
const PLATFORMS_MAX = 20;

const str = (v) => (typeof v === "string" ? v : "");
const idStr = (v) => (v ? v.toString() : "");
const oid = (id) => new mongoose.Types.ObjectId(id);
const validId = (v) => typeof v === "string" && mongoose.isValidObjectId(v);

/** The ONLY HTML the editor may store: Tiptap's bold/italic/underline/lists/align. */
const RICH_TEXT = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li"],
  allowedAttributes: { p: ["style"], li: ["style"] },
  allowedStyles: { "*": { "text-align": [/^(left|center)$/] } },
  disallowedTagsMode: "discard",
};

/** Sanitised HTML, "" when it has no text. */
export function sanitizeRichText(html) {
  const clean = sanitizeHtml(str(html).slice(0, EDITING_REQUIREMENTS_MAX * 5), RICH_TEXT).trim();
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).trim();
  return text ? clean : "";
}

/**
 * The ONE related item (lib/tasks/related.js) for `input` = { kind, refId } or
 * null (none). `existing` is the stored value already normalised from either
 * shape; an unchanged selection keeps its stored snapshot (works even if MSDB is
 * unreachable). A new pick must exist in the mirror (active or inactive).
 */
async function resolveRelated(input, existing, errors) {
  if (input == null || (typeof input === "object" && !input.refId)) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    errors.related = "Choose one related item.";
    return null;
  }
  const kind = str(input.kind);
  const refId = str(input.refId);
  if (!RELATED_KINDS.includes(kind) || !validId(refId)) {
    errors.related = "Choose a course, program or skill from the list.";
    return null;
  }
  if (existing && existing.kind === kind && existing.refId === refId) return existing;
  try {
    const item = await getRelatedRef(kind, refId);
    if (!item) {
      errors.related = "That item is no longer available. Choose another.";
      return null;
    }
    return { kind, refId, snapshot: { code: item.code, name: item.name, iconUrl: item.iconUrl, isInhouse: item.isInhouse } };
  } catch {
    errors.related = "Can't look up related items right now. Try again, or clear this field.";
    return null;
  }
}

/** Clip: Video Overview · Brief & References · Related · Work & Assign · Reviewers · Timeline. */
async function parseClipDetails(input, { project, existing, type }) {
  const errors = {};
  const prev = existing?.details ?? {};

  // Options: active ones, plus ones this task already uses (inactive still allowed).
  const videoType = str(input.videoType);
  const platforms = [...new Set(Array.isArray(input.platforms) ? input.platforms.map(str) : [])];
  const ids = [videoType, ...platforms].filter(validId);
  const options = ids.length ? await TaskOption.find({ _id: { $in: ids } }).lean() : [];
  const byId = new Map(options.map((o) => [o._id.toString(), o]));
  const kept = new Set([idStr(prev.videoType), ...(prev.platforms ?? []).map(idStr)]);
  const usable = (id, list) => {
    const o = byId.get(id);
    return !!o && o.list === list && (o.active || kept.has(id));
  };

  if (!videoType) errors.videoType = "Choose a video type.";
  else if (!usable(videoType, "video_type")) errors.videoType = "Choose a video type from the list.";

  if (platforms.length === 0) errors.platforms = "Choose at least one platform.";
  else if (platforms.length > PLATFORMS_MAX) errors.platforms = `Choose at most ${PLATFORMS_MAX} platforms.`;
  else if (!platforms.every((id) => usable(id, "platform"))) errors.platforms = "Choose platforms from the list.";

  const fileLocation = str(input.fileLocation).trim();
  if (fileLocation.length > FILE_LOCATION_MAX) errors.fileLocation = `Use at most ${FILE_LOCATION_MAX} characters.`;

  const editingRequirements = sanitizeRichText(input.editingRequirements);
  if (editingRequirements.length > EDITING_REQUIREMENTS_MAX) {
    errors.editingRequirements = "This brief is too long. Shorten it a little.";
  }

  const referenceUrl = str(input.referenceUrl).trim();
  if (referenceUrl && (referenceUrl.length > REFERENCE_URL_MAX || !isHttpUrl(referenceUrl))) {
    errors.referenceUrl = "Enter a full http:// or https:// link.";
  }

  // Related: at most ONE item. Legacy relatedCourse/Program/Skill input is ignored;
  // saving writes only `related` (the whole details object is replaced, so the
  // legacy keys are dropped).
  const related = await resolveRelated(input.related, normalizeRelated(prev).related, errors);

  const workLevel = str(input.workLevel);
  if (!WORK_LEVEL_KEYS.includes(workLevel)) errors.workLevel = "Choose a work level.";

  // People: NEW picks must be eligible for THIS project and type (same rule as
  // the pickers). An unchanged stored person passes even if no longer eligible
  // (the form warns; clearing/replacing is the user's explicit choice).
  const eligible = await taskEligibility(project, type);
  const stored = { assignee: idStr(existing?.assignee), contentReviewer: idStr(prev.contentReviewer), videoReviewer: idStr(prev.videoReviewer) };
  const person = (field, set, message) => {
    const id = str(input[field]);
    if (!id) return null;
    if (validId(id) && id === stored[field]) return oid(id);
    if (!validId(id) || !set.has(id)) {
      errors[field] = message;
      return null;
    }
    return oid(id);
  };
  const assignee = person("assignee", eligible.assignee, "This person can't be assigned clip tasks in this project.");
  const contentReviewer = person("contentReviewer", eligible.contentReviewer, "This person can't review content in this project.");
  const videoReviewer = person("videoReviewer", eligible.videoReviewer, "This person can't review video in this project.");

  // Timeline (Bangkok wall clock). Date without time: start 09:00, due 18:00.
  const startAt = parseBangkokDateTime(input.startDate, input.startTime, "09:00");
  const dueAt = parseBangkokDateTime(input.dueDate, input.dueTime, "18:00");
  if (startAt === undefined) errors.startAt = "Enter a valid date and time.";
  if (dueAt === undefined) errors.dueAt = "Enter a valid date and time.";
  if (startAt && dueAt && dueAt < startAt) errors.dueAt = "Due date can't be before the start date.";

  if (Object.keys(errors).length) return { errors };
  return {
    values: {
      details: {
        videoType: oid(videoType),
        platforms: platforms.map(oid),
        fileLocation,
        editingRequirements,
        referenceUrl,
        related,
        workLevel,
        contentReviewer,
        videoReviewer,
      },
      assignee,
      startAt,
      dueAt,
    },
  };
}

/** type → details parser, or null = details not available yet. */
export const TASK_DETAILS = Object.fromEntries(TASK_TYPE_KEYS.map((k) => [k, null]));
TASK_DETAILS.clip = parseClipDetails;

/** Type keys whose details step exists (passed to the drawer). */
export const detailTypes = () => TASK_TYPE_KEYS.filter((k) => TASK_DETAILS[k]);

/**
 * @param {string} type
 * @param {unknown} raw  JSON string from the form
 * @param {{ project: object, existing?: object | null }} ctx
 */
export async function parseTaskDetails(type, raw, ctx) {
  const parse = TASK_DETAILS[type];
  if (!parse) return { errors: { details: "Details aren't available for this task type yet." } };
  let input;
  try {
    input = JSON.parse(str(raw));
  } catch {
    input = null;
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: { details: "Invalid details." } };
  return parse(input, { ...ctx, type });
}
