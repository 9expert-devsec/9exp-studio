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
import { isOwnTaskPhotoId, isTaskPhotoUrl } from "@/lib/cloudinary";
import { getRelatedRef } from "@/lib/msdb";
import { getWorkTypesForPlatforms } from "@/lib/tasks/optionQueries";
import { RELATED_KINDS, normalizeRelated } from "@/lib/tasks/related";
import { GRAPHIC_FILE_LOCATION_MAX, GRAPHIC_ITEMS_MAX, GRAPHIC_PHOTOS_MAX } from "@/lib/tasks/graphic";
import { TASK_TYPE_KEYS, WORK_LEVEL_KEYS } from "@/lib/tasks/types";
import { relatedAssetIds, validateRelatedAssets } from "@/lib/tasks/assets";
import { chosenFolderError, folderChoice, folderTexts } from "@/lib/tasks/folders";
import Task from "@/models/Task";
import TaskFolder from "@/models/TaskFolder";
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

/**
 * People fields (assignee is a task field; reviewers live in details). NEW picks
 * must be eligible for THIS project and type (access.js taskEligibility, the same
 * rule as the pickers). An unchanged stored person passes even if no longer
 * eligible (the form warns; clearing/replacing is the user's explicit choice).
 * @param {Record<string, string>} messages field → error message; the field name
 *   is also the eligibility set (assignee / contentReviewer / videoReviewer / designReviewer)
 */
async function parsePeople(input, { project, type, existing }, messages, errors) {
  const eligible = await taskEligibility(project, type);
  const prev = existing?.details ?? {};
  const out = {};
  for (const [field, message] of Object.entries(messages)) {
    const stored = idStr(field === "assignee" ? existing?.assignee : prev[field]);
    const id = str(input[field]);
    if (!id) out[field] = null;
    else if (validId(id) && id === stored) out[field] = oid(id);
    else if (!validId(id) || !eligible[field]?.has(id)) {
      errors[field] = message;
      out[field] = null;
    } else out[field] = oid(id);
  }
  return out;
}

/** Timeline (Bangkok wall clock). Date without time: start 09:00, due 18:00. */
function parseTimeline(input, errors) {
  const startAt = parseBangkokDateTime(input.startDate, input.startTime, "09:00");
  const dueAt = parseBangkokDateTime(input.dueDate, input.dueTime, "18:00");
  if (startAt === undefined) errors.startAt = "Enter a valid date and time.";
  if (dueAt === undefined) errors.dueAt = "Enter a valid date and time.";
  if (startAt && dueAt && dueAt < startAt) errors.dueAt = "Due date can't be before the start date.";
  return { startAt, dueAt };
}

/** Brief / requirements rich text + reference link (shared by every type). */
function parseBrief(input, field, errors) {
  const html = sanitizeRichText(input[field]);
  if (html.length > EDITING_REQUIREMENTS_MAX) errors[field] = "This brief is too long. Shorten it a little.";
  const referenceUrl = str(input.referenceUrl).trim();
  if (referenceUrl && (referenceUrl.length > REFERENCE_URL_MAX || !isHttpUrl(referenceUrl))) {
    errors.referenceUrl = "Enter a full http:// or https:// link.";
  }
  return { html, referenceUrl };
}

/**
 * Shared folder (Graphic / Photo, round 36; rules in lib/tasks/folders.js).
 * Returns `{ mode, folderId, set }` for the action:
 *   mode "new"    (create only) the action issues the ID + creates the TaskFolder
 *   mode "choose" an existing folder of THIS project with the type's suffix
 *                 (checked here against the DB: exists, project, suffix)
 *   mode "keep"   edit: the task's current folder (or none on older tasks)
 * `set` = the folder-level texts from the form ({ location } for Graphic,
 * { name, location } for Photo); the action writes them to the folder (or, for a
 * task with no folder, back into its details).
 * @param {{ name?: string, location: string }} fields form field names (also error keys)
 */
async function parseFolder(input, { project, existing, type }, fields, errors) {
  const choice = folderChoice(input.folder, { isEdit: !!existing, currentFolderId: existing?.folderId ?? null });
  if (choice.error) errors.folder = choice.error;
  else if (choice.mode === "choose") {
    const folder = await TaskFolder.findOne({ folderId: choice.folderId }).select("folderId suffix project").lean();
    const error = chosenFolderError(folder, { projectId: project._id, type });
    if (error) errors.folder = error;
  }
  const texts = folderTexts({ name: fields.name ? input[fields.name] : "", location: input[fields.location] }, fields, errors);
  const set = fields.name ? texts : { location: texts.location };
  return { mode: choice.mode ?? "keep", folderId: choice.folderId ?? null, set };
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

  const { html: editingRequirements, referenceUrl } = parseBrief(input, "editingRequirements", errors);

  // Related: at most ONE item. Legacy relatedCourse/Program/Skill input is ignored;
  // saving writes only `related` (the whole details object is replaced, so the
  // legacy keys are dropped).
  const related = await resolveRelated(input.related, normalizeRelated(prev).related, errors);

  const workLevel = str(input.workLevel);
  if (!WORK_LEVEL_KEYS.includes(workLevel)) errors.workLevel = "Choose a work level.";

  const { assignee, contentReviewer, videoReviewer } = await parsePeople(
    input,
    { project, type, existing },
    {
      assignee: "This person can't be assigned clip tasks in this project.",
      contentReviewer: "This person can't review content in this project.",
      videoReviewer: "This person can't review video in this project.",
    },
    errors
  );
  const { startAt, dueAt } = parseTimeline(input, errors);

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

/** Photos: ≤ 10 of OUR Cloudinary task photos; a newly added one must be the viewer's own upload. */
function parsePhotos(input, prev, viewerId, errors) {
  const raw = Array.isArray(input.photos) ? input.photos : [];
  const prevIds = new Set((prev.photos ?? []).map((p) => p?.publicId));
  const seen = new Set();
  const photos = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const publicId = str(p.publicId);
    const url = str(p.url);
    if (seen.has(publicId)) continue;
    const isNew = !prevIds.has(publicId);
    if (!isOwnTaskPhotoId(publicId, isNew ? viewerId : null) || !isTaskPhotoUrl(url, publicId)) {
      errors.photos = "One of the photos isn't valid. Remove it and upload it again.";
      return [];
    }
    const dim = (v) => (Number.isInteger(v) && v > 0 && v <= 100000 ? v : null);
    seen.add(publicId);
    photos.push({ url, publicId, width: dim(p.width), height: dim(p.height) });
  }
  if (photos.length > GRAPHIC_PHOTOS_MAX) errors.photos = `Add at most ${GRAPHIC_PHOTOS_MAX} photos.`;
  return photos;
}

/**
 * ONE platform (active, or the one this task already uses) + ONE work type linked
 * to it (round 27; getWorkTypesForPlatforms). The stored pair (same platform +
 * work type) stays valid even if it went inactive. `noun` = the field's label
 * ("work type" for Graphic, "post type" for Post — same Work Type list).
 */
async function parsePlatformWorkType(input, prev, noun, errors) {
  const platform = str(input.platform);
  let platformDoc = null;
  if (!platform) errors.platform = "Choose a platform.";
  else if (!validId(platform)) errors.platform = "Choose a platform from the list.";
  else {
    platformDoc = await TaskOption.findOne({ _id: platform, list: "platform" }).select("active").lean();
    if (!platformDoc || !(platformDoc.active || platform === idStr(prev.platform))) {
      errors.platform = "Choose a platform from the list.";
      platformDoc = null;
    }
  }

  const workType = str(input.workType);
  if (!workType) errors.workType = `Choose a ${noun}.`;
  else if (platformDoc) {
    const unchanged = workType === idStr(prev.workType) && platform === idStr(prev.platform);
    const linked = (await getWorkTypesForPlatforms([platform])).some((w) => w.id === workType);
    const stillExists = unchanged && validId(workType) && (await TaskOption.exists({ _id: workType, list: "work_type" }));
    if (!linked && !stillExists) errors.workType = `Choose a ${noun} for this platform.`;
  }
  return { platform, workType };
}

/**
 * Graphic (Figma 148:1062): Platform & Work Type · Source & Asset · Brief &
 * References · Related · Work & Assign · Reviewer Assign · Timeline.
 * Required: platform, workType, items, workLevel. Folder (round 36): New / Choose
 * (parseFolder); File Location is the FOLDER's location (shared by its tasks).
 */
async function parseGraphicDetails(input, { project, existing, type, viewerId }) {
  const errors = {};
  const prev = existing?.details ?? {};

  const { platform, workType } = await parsePlatformWorkType(input, prev, "work type", errors);

  const items = typeof input.items === "number" ? input.items : Number(str(input.items));
  if (!Number.isInteger(items) || items < 1 || items > GRAPHIC_ITEMS_MAX) {
    errors.items = `Enter a whole number from 1 to ${GRAPHIC_ITEMS_MAX}.`;
  }

  const folder = await parseFolder(input, { project, existing, type }, { location: "fileLocation" }, errors);
  if (folder.set.location.length > GRAPHIC_FILE_LOCATION_MAX) {
    errors.fileLocation = `Use at most ${GRAPHIC_FILE_LOCATION_MAX} characters.`;
  }

  const photos = parsePhotos(input, prev, viewerId, errors);
  const { html: brief, referenceUrl } = parseBrief(input, "brief", errors);
  const related = await resolveRelated(input.related, normalizeRelated(prev).related, errors);

  const workLevel = str(input.workLevel);
  if (!WORK_LEVEL_KEYS.includes(workLevel)) errors.workLevel = "Choose a work level.";

  const { assignee, contentReviewer, designReviewer } = await parsePeople(
    input,
    { project, type, existing },
    {
      assignee: "This person can't be assigned graphic tasks in this project.",
      contentReviewer: "This person can't review content in this project.",
      designReviewer: "This person can't review design in this project.",
    },
    errors
  );
  const { startAt, dueAt } = parseTimeline(input, errors);

  if (Object.keys(errors).length) return { errors };
  return {
    values: {
      details: {
        platform: oid(platform),
        workType: oid(workType),
        items,
        photos,
        brief,
        referenceUrl,
        related,
        workLevel,
        contentReviewer,
        designReviewer,
      },
      folder,
      assignee,
      startAt,
      dueAt,
    },
  };
}

/**
 * Photo (Figma 169:963): Folder & Photo Type · Related · Work & Assign ·
 * Timeline. Required: photoType (ONE option of the Photo Type list — active, or
 * the one this task already uses). Folder: New / Choose (parseFolder, suffix P);
 * Folder Name + Location are the FOLDER's. Camera Man = the task's assignee;
 * Editor = details.editor; both from roles allowed to do Photo. Shoot Date /
 * Output Date = the task's startAt / dueAt.
 */
async function parsePhotoDetails(input, { project, existing, type }) {
  const errors = {};
  const prev = existing?.details ?? {};

  const folder = await parseFolder(input, { project, existing, type }, { name: "folderName", location: "folderLocation" }, errors);

  const photoType = str(input.photoType);
  if (!photoType) errors.photoType = "Choose a photo type.";
  else if (!validId(photoType)) errors.photoType = "Choose a photo type from the list.";
  else {
    const o = await TaskOption.findOne({ _id: photoType, list: "photo_type" }).select("active").lean();
    if (!o || !(o.active || photoType === idStr(prev.photoType))) errors.photoType = "Choose a photo type from the list.";
  }

  const related = await resolveRelated(input.related, normalizeRelated(prev).related, errors);
  const { assignee, editor } = await parsePeople(
    input,
    { project, type, existing },
    {
      assignee: "This person can't be the camera man for photo tasks in this project.",
      editor: "This person can't edit photo tasks in this project.",
    },
    errors
  );
  const { startAt, dueAt } = parseTimeline(input, errors);
  if (errors.dueAt === "Due date can't be before the start date.") errors.dueAt = "Output date can't be before the shoot date.";

  if (Object.keys(errors).length) return { errors };
  return {
    values: {
      details: { photoType: oid(photoType), related, editor },
      folder,
      assignee,
      startAt,
      dueAt,
    },
  };
}

/**
 * Post (Figma 152:6): Platform & Post Type · Wording Post · Related · Assign Post ·
 * Related Assets · Schedule Post. Required: platform, post type (= the Work Type
 * list). Schedule Post IS the task's due date (Bangkok; date only → 18:00); a post
 * has no start date. Related Assets: ids only (lib/tasks/assets.js), each an
 * existing Clip/Graphic/Photo/Article task in ANY project. The Status Asset is
 * derived from them at read time (never stored here).
 */
async function parsePostDetails(input, { project, existing, type }) {
  const errors = {};
  const prev = existing?.details ?? {};

  const { platform, workType } = await parsePlatformWorkType(input, prev, "post type", errors);
  const { html: brief } = parseBrief(input, "brief", errors);
  const related = await resolveRelated(input.related, normalizeRelated(prev).related, errors);

  const { assignee } = await parsePeople(
    input,
    { project, type, existing },
    { assignee: "This person can't be assigned post tasks in this project." },
    errors
  );

  const relatedAssets = await parseRelatedAssets(input, existing, errors);

  const dueAt = parseBangkokDateTime(input.dueDate, input.dueTime, "18:00");
  if (dueAt === undefined) errors.dueAt = "Enter a valid date and time.";

  if (Object.keys(errors).length) return { errors };
  return {
    values: {
      details: {
        platform: oid(platform),
        workType: oid(workType),
        brief,
        related,
        relatedAssets,
      },
      assignee,
      startAt: null,
      dueAt,
    },
  };
}

/**
 * Related Assets (Post, Article): existence + type of each linked task come from
 * the DB; the rules are pure (lib/tasks/assets.js: ≤ 20, unique, Clip / Graphic /
 * Photo / Article, never the task itself). Returns ObjectIds ([] on error).
 */
async function parseRelatedAssets(input, existing, errors) {
  const postedIds = (relatedAssetIds(input.relatedAssets) ?? []).filter(validId);
  const found = postedIds.length ? await Task.find({ _id: { $in: postedIds } }).select("type").lean() : [];
  const assets = validateRelatedAssets(input.relatedAssets ?? null, {
    selfId: existing?._id ? idStr(existing._id) : null,
    typeById: new Map(found.map((t) => [t._id.toString(), t.type])),
  });
  if (!assets.ok) {
    errors.relatedAssets = assets.error;
    return [];
  }
  return assets.ids.map(oid);
}

/**
 * Article (Figma 169:698 + ruled additions): Article Type · Related · Writer ·
 * Related Assets · Timeline. Required: articleType (ONE option of the Article
 * Type list — active, or the one this task already uses). Writer = the task's
 * assignee (roles allowed to do Article). Dates: the task's startAt / dueAt.
 */
async function parseArticleDetails(input, { project, existing, type }) {
  const errors = {};
  const prev = existing?.details ?? {};

  const articleType = str(input.articleType);
  if (!articleType) errors.articleType = "Choose an article type.";
  else if (!validId(articleType)) errors.articleType = "Choose an article type from the list.";
  else {
    const o = await TaskOption.findOne({ _id: articleType, list: "article_type" }).select("active").lean();
    if (!o || !(o.active || articleType === idStr(prev.articleType))) errors.articleType = "Choose an article type from the list.";
  }

  const related = await resolveRelated(input.related, normalizeRelated(prev).related, errors);
  const { assignee } = await parsePeople(
    input,
    { project, type, existing },
    { assignee: "This person can't write articles in this project." },
    errors
  );
  const relatedAssets = await parseRelatedAssets(input, existing, errors);
  const { startAt, dueAt } = parseTimeline(input, errors);

  if (Object.keys(errors).length) return { errors };
  return {
    values: {
      details: { articleType: oid(articleType), related, relatedAssets },
      assignee,
      startAt,
      dueAt,
    },
  };
}

/** Cloudinary public ids in `oldDetails.photos` that are not in `newDetails.photos`. */
export function removedPhotoIds(oldDetails, newDetails) {
  const keep = new Set((newDetails?.photos ?? []).map((p) => p?.publicId));
  return (oldDetails?.photos ?? []).map((p) => p?.publicId).filter((id) => id && !keep.has(id));
}

/** type → details parser, or null = details not available yet. */
export const TASK_DETAILS = Object.fromEntries(TASK_TYPE_KEYS.map((k) => [k, null]));
TASK_DETAILS.clip = parseClipDetails;
TASK_DETAILS.graphic = parseGraphicDetails;
TASK_DETAILS.post = parsePostDetails;
TASK_DETAILS.article = parseArticleDetails;
TASK_DETAILS.photo = parsePhotoDetails;

/** Type keys whose details step exists (passed to the drawer). */
export const detailTypes = () => TASK_TYPE_KEYS.filter((k) => TASK_DETAILS[k]);

/**
 * @param {string} type
 * @param {unknown} raw  JSON string from the form
 * @param {{ project: object, existing?: object | null, viewerId?: string }} ctx
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
