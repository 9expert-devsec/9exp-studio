// Duplicate task / content — pure payload builders (no DB). The server actions
// add the numbers (task/content sequence) and sortOrder.
//
// Duplicate task = copy the details, start fresh:
//   copies   type, details (Clip/Graphic/Post Step 2 fields, related, a post's
//            relatedAssets, …), assignee, startAt/dueAt, description
//   resets   status → the type's FIRST status (a post's Status Asset is derived,
//            so nothing is stored),
//            createdBy → the duplicator (createdAt/updatedAt → now, by Mongoose)
//   keeps    folderId — the copy joins the ORIGINAL's shared folder (round 36;
//            replaces round 30's "new Folder ID per copy")
//   drops    _id, number, sortOrder, photos (the Cloudinary assets belong to the
//            original → [])
//   title    + " (copy)" (the original part is trimmed to fit the max length)

import { CONTENT_NAME_MAX, TASK_TITLE_MAX } from "../projects/rules.js";
import { initialStatus } from "./types.js";

export const COPY_SUFFIX = " (copy)";

/** "Title" → "Title (copy)", trimmed so the result is at most `max` characters. */
export function copyTitle(title, max) {
  const base = String(title ?? "").trim();
  const room = Math.max(max - COPY_SUFFIX.length, 0);
  return `${base.length > room ? base.slice(0, room).trimEnd() : base}${COPY_SUFFIX}`;
}

/**
 * New task fields from an existing task document.
 * @param {object} task  the original (lean doc)
 * @param {{ createdBy: unknown, project?: unknown, content?: unknown }} opts
 *   project/content default to the original's (a content duplicate passes the new
 *   content of the SAME project, so the shared folder stays valid).
 */
export function buildTaskCopy(task, { createdBy, project = task.project, content = task.content }) {
  const folderId = task.folderId || null;
  const details = { ...(task.details ?? {}) };
  if ("photos" in details || task.type === "graphic") details.photos = [];
  return {
    project,
    content,
    title: copyTitle(task.title, TASK_TITLE_MAX),
    type: task.type,
    status: initialStatus(task.type),
    statusBeforeHold: null, // round 40: a fresh copy has no pause/cancel memory
    assetStatus: null, // post: derived from its Related Assets at read time (lib/tasks/assets.js)
    assignee: task.assignee ?? null,
    startAt: task.startAt ?? null,
    dueAt: task.dueAt ?? null,
    description: task.description ?? "",
    details,
    ...(folderId ? { folderId } : {}),
    createdBy,
    updatedBy: createdBy,
  };
}

/** New content fields from an existing content document (status re-derived after its tasks are copied). */
export function buildContentCopy(content, { createdBy }) {
  return {
    project: content.project,
    name: copyTitle(content.name, CONTENT_NAME_MAX),
    description: content.description ?? "",
    briefLink: content.briefLink ?? "",
    dueDate: content.dueDate ?? null,
    status: "open",
    createdBy,
  };
}
