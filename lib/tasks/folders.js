// Shared task folders (round 36) — pure rules (no DB). Shared by the server
// (lib/tasks/details.js, the task actions), the migration script and node checks.
//
// A folder (models/TaskFolder.js) is identified by its Folder ID "YYMM-NNN<suffix>"
// (lib/tasks/folderId.js). Several tasks of the same project and suffix can share
// one: tasks keep `folderId` (string) as the link. The folder holds the shared
// `name` and `location`.
//   Create:  New Folder (default) → the create action issues the next ID and
//            creates the folder; Choose Folder → an existing folder of THIS
//            project with the SAME suffix.
//   Edit:    keep the current folder, or switch to another existing one (same
//            project + suffix). Never a new number.

import { folderSuffixForType, parseFolderId } from "./folderId.js";

export const FOLDER_NAME_MAX = 200;
export const FOLDER_LOCATION_MAX = 1000;

/**
 * What the posted `folder` input asks for.
 * @param {unknown} raw  { mode: "new" | "choose", folderId?: string }
 * @param {{ isEdit: boolean, currentFolderId?: string | null }} ctx
 * @returns {{ mode: "new" } | { mode: "keep", folderId: string | null } | { mode: "choose", folderId: string } | { error: string }}
 */
export function folderChoice(raw, { isEdit, currentFolderId = null }) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const wanted = typeof input.folderId === "string" ? input.folderId.trim() : "";
  if (input.mode === "choose") {
    if (!wanted) return { error: "Choose a folder." };
    if (!parseFolderId(wanted)) return { error: "Choose a folder from the list." };
    if (isEdit && wanted === currentFolderId) return { mode: "keep", folderId: currentFolderId };
    return { mode: "choose", folderId: wanted };
  }
  // Edit never issues a number: anything else keeps the current folder (or none).
  if (isEdit) return { mode: "keep", folderId: currentFolderId || null };
  return { mode: "new" };
}

/**
 * A chosen folder must exist, belong to the task's project and carry the task
 * type's suffix. Returns an error message, or null when it is usable.
 * @param {{ folderId: string, suffix: string, project: unknown } | null} folder
 * @param {{ projectId: unknown, type: string }} ctx
 */
export function chosenFolderError(folder, { projectId, type }) {
  const suffix = folderSuffixForType(type);
  if (!suffix) return "This task type has no folders.";
  if (!folder) return "That folder no longer exists. Choose another.";
  if (String(folder.project) !== String(projectId)) return "Choose a folder from this project.";
  if (folder.suffix !== suffix || parseFolderId(folder.folderId)?.suffix !== suffix) {
    return `Choose a ${suffix} folder for this task type.`;
  }
  return null;
}

/** The folder's shared text fields from the form (trimmed) + errors keyed by form field. */
export function folderTexts({ name, location }, fields, errors) {
  const out = { name: typeof name === "string" ? name.trim() : "", location: typeof location === "string" ? location.trim() : "" };
  if (fields.name && out.name.length > FOLDER_NAME_MAX) errors[fields.name] = `Use at most ${FOLDER_NAME_MAX} characters.`;
  if (out.location.length > FOLDER_LOCATION_MAX) errors[fields.location] = `Use at most ${FOLDER_LOCATION_MAX} characters.`;
  return out;
}

/**
 * Choose Folder list label: "<folderId> · <name, or the newest task's title>".
 * @param {{ folderId: string, name?: string }} folder @param {string} [newestTitle]
 */
export const folderOptionLabel = (folder, newestTitle = "") =>
  `${folder.folderId} · ${folder.name?.trim() || newestTitle || "Untitled folder"}`;

const time = (v) => (v ? new Date(v).getTime() : Number.POSITIVE_INFINITY);

/**
 * Migration plan (scripts/migrate-task-folders.mjs): one folder per distinct
 * task `folderId`, from the EARLIEST task using it (createdAt, then _id):
 * project, createdBy, createdAt, location = its details.fileLocation (or ""),
 * name "". IDs that don't parse are skipped and listed.
 * @param {{ _id: unknown, folderId?: string, project: unknown, createdBy?: unknown, createdAt?: unknown, details?: object }[]} tasks
 * @returns {{ folders: object[], skipped: string[], multiProject: string[] }}
 */
export function planFolderMigration(tasks) {
  const groups = new Map();
  for (const t of tasks) {
    if (!t?.folderId) continue;
    if (!groups.has(t.folderId)) groups.set(t.folderId, []);
    groups.get(t.folderId).push(t);
  }
  const folders = [];
  const skipped = [];
  const multiProject = [];
  for (const [folderId, list] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const parsed = parseFolderId(folderId);
    if (!parsed) {
      skipped.push(folderId);
      continue;
    }
    const first = [...list].sort((a, b) => time(a.createdAt) - time(b.createdAt) || String(a._id).localeCompare(String(b._id)))[0];
    if (new Set(list.map((t) => String(t.project))).size > 1) multiProject.push(folderId);
    const location = typeof first.details?.fileLocation === "string" ? first.details.fileLocation.trim() : "";
    folders.push({
      folderId,
      suffix: parsed.suffix,
      project: first.project,
      name: "",
      location,
      createdBy: first.createdBy ?? null,
      createdAt: first.createdAt ?? null,
      taskCount: list.length,
    });
  }
  return { folders, skipped, multiProject };
}
