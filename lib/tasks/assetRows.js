// Post "Related Assets" — DB reads. Server only. The rules (validation, derived
// Status Asset) are pure in lib/tasks/assets.js.
//
// Rows are LIVE data read at display time (posts store ids only); a linked task
// that was deleted simply isn't returned. Rows carry only what the UI shows.

import "server-only";
import { deriveAssetStatus } from "@/lib/tasks/assets";
import { getTaskType, statusInfo } from "@/lib/tasks/types";
import Project from "@/models/Project";
import Task from "@/models/Task";
import User from "@/models/User";

const idOf = (v) => (v ? v.toString() : "");

/**
 * Task docs ({ type, status, title, folderId, project, assignee }) → rows:
 * { id, type, typeLabel, folderId, title, projectName, assigneeName, status, statusLabel, group }.
 */
export async function assetRows(tasks) {
  if (!tasks.length) return [];
  const [projects, users] = await Promise.all([
    Project.find({ _id: { $in: [...new Set(tasks.map((t) => idOf(t.project)))] } }).select("name").lean(),
    User.find({ _id: { $in: [...new Set(tasks.map((t) => idOf(t.assignee)).filter(Boolean))] } }).select("name").lean(),
  ]);
  const projectName = new Map(projects.map((p) => [idOf(p._id), p.name]));
  const userName = new Map(users.map((u) => [idOf(u._id), u.name]));
  return tasks.map((t) => {
    const info = statusInfo(t.type, t.status);
    return {
      id: idOf(t._id),
      type: t.type,
      typeLabel: getTaskType(t.type)?.label ?? t.type,
      folderId: t.folderId ?? null,
      title: t.title,
      projectName: projectName.get(idOf(t.project)) ?? "Unknown project",
      assigneeName: t.assignee ? (userName.get(idOf(t.assignee)) ?? "Unknown") : "Unassigned",
      status: t.status,
      statusLabel: info.label,
      group: info.group,
    };
  });
}

/** Rows for a post's stored asset ids, in the stored order; deleted tasks are dropped. */
export async function loadAssetRows(ids) {
  const list = (ids ?? []).map(idOf).filter(Boolean);
  if (!list.length) return [];
  const docs = await Task.find({ _id: { $in: list } }).select("type status title folderId project assignee").lean();
  const byId = new Map(docs.map((d) => [idOf(d._id), d]));
  return assetRows(list.map((id) => byId.get(id)).filter(Boolean));
}

/**
 * Derived Status Asset key per POST task (one query for all their assets).
 * @param {object[]} tasks any task docs; only type "post" are considered
 * @returns {Promise<Map<string, string>>} postId → asset status key
 */
export async function derivedAssetStatuses(tasks) {
  const posts = tasks.filter((t) => t.type === "post");
  if (!posts.length) return new Map();
  const ids = [...new Set(posts.flatMap((p) => (p.details?.relatedAssets ?? []).map(idOf)))];
  const assets = ids.length ? await Task.find({ _id: { $in: ids } }).select("type status").lean() : [];
  const byId = new Map(assets.map((a) => [idOf(a._id), a]));
  return new Map(
    posts.map((p) => [
      idOf(p._id),
      deriveAssetStatus((p.details?.relatedAssets ?? []).map((id) => byId.get(idOf(id))).filter(Boolean)),
    ])
  );
}
