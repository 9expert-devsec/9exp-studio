// Edit Task drawer pre-fill — pure mapping (no DB), shared by lib/projects/queries.js
// (loadTaskDrawer) and node checks. A stored task → the plain values the Step 2
// forms use (ids as strings). Option fields (platform, workType, videoType,
// platforms, articleType, photoType) map to the option's id string; the drawer's
// option lists include an inactive option the task already uses, so it still
// pre-fills (queries.js loadTaskDrawer).

import { toBangkokInputs } from "../projects/rules.js";
import { relatedToPickerValue } from "./related.js";
import { sessionsFromDetails } from "./shootSessions.js";

export const idOf = (v) => (v ? v.toString() : "");

/**
 * @param {object} task  lean task doc
 * @param {{ related: object | null, hadMultiple: boolean }} rel  normalizeRelated(details), icon-filled
 */
export function detailsForEdit(task, rel) {
  const d = task.details ?? {};
  const start = toBangkokInputs(task.startAt);
  const due = toBangkokInputs(task.dueAt);
  const common = {
    fileLocation: d.fileLocation ?? "",
    referenceUrl: d.referenceUrl ?? "",
    // ONE related item (lib/tasks/related.js normalises legacy multi-field data).
    related: relatedToPickerValue(rel?.related ?? null),
    relatedHadMultiple: !!rel?.hadMultiple,
    workLevel: d.workLevel ?? "",
    assignee: idOf(task.assignee),
    contentReviewer: idOf(d.contentReviewer),
    startDate: start.date,
    startTime: start.time,
    dueDate: due.date,
    dueTime: due.time,
    hasDetails: Object.keys(d).length > 0,
  };
  if (task.type === "article") {
    return {
      ...common,
      articleType: idOf(d.articleType),
      // Ids here; loadTaskDrawer swaps in live rows (deleted tasks dropped).
      relatedAssets: (d.relatedAssets ?? []).map(idOf),
    };
  }
  if (task.type === "production") {
    return {
      ...common,
      brief: d.brief ?? "",
      scriptUrl: d.scriptUrl ?? "",
      recordUrl: d.recordUrl ?? "",
      // Picker entries; loadTaskDrawer makes sure each one has a row to show.
      videographers: (d.videographers ?? []).map((id) => ({ kind: "user", id: idOf(id) })),
      presenters: (d.presenters ?? []).filter((p) => p?.id).map((p) => ({ kind: p.kind === "external" ? "external" : "user", id: idOf(p.id) })),
      // Round 57.1: the นัดถ่าย list (a legacy single appointment reads as one row).
      shootSessions: sessionsFromDetails(d).map((x) => ({ _id: x._id, date: x.date, startTime: x.startTime, endTime: x.endTime ?? "", location: x.location ?? "" })),
    };
  }
  if (task.type === "post") {
    return {
      ...common,
      platform: idOf(d.platform),
      workType: idOf(d.workType),
      brief: d.brief ?? "",
      // Ids here; loadTaskDrawer swaps in live rows (deleted tasks dropped).
      relatedAssets: (d.relatedAssets ?? []).map(idOf),
    };
  }
  // Shared folder (round 36/37): a task WITH a folder keeps it unless "Change
  // folder" picks another; a task WITHOUT one starts on "Choose Folder" (New
  // Folder is an explicit pick). loadTaskDrawer fills the folder-level texts.
  const currentFolderId = task.folderId ?? ""; // display only (the server reads the task's own)
  const folder = currentFolderId ? { mode: "keep", folderId: currentFolderId } : { mode: "none", folderId: "" };
  if (task.type === "graphic") {
    return {
      ...common,
      platform: idOf(d.platform),
      workType: idOf(d.workType),
      items: Number.isInteger(d.items) ? d.items : 1,
      photos: (d.photos ?? []).map((p) => ({ url: p.url, publicId: p.publicId, width: p.width ?? null, height: p.height ?? null })),
      brief: d.brief ?? "",
      designReviewer: idOf(d.designReviewer),
      folder,
      currentFolderId,
    };
  }
  if (task.type === "photo") {
    return {
      ...common,
      photoType: idOf(d.photoType),
      editor: idOf(d.editor),
      // Folder texts (a task without a folder keeps them in its details).
      folderName: d.folderName ?? "",
      folderLocation: d.folderLocation ?? "",
      folder,
      currentFolderId,
    };
  }
  return {
    ...common,
    videoType: idOf(d.videoType),
    platforms: (d.platforms ?? []).map(idOf),
    editingRequirements: d.editingRequirements ?? "",
    videoReviewer: idOf(d.videoReviewer),
    // Round 45: an id here; loadTaskDrawer clears it when that task is gone.
    relatedProduction: idOf(d.relatedProductionId),
  };
}
