// Task-option DB reads shared by the drawer loader (lib/projects/queries.js) and
// Step 2 validation (lib/tasks/details.js). Server only.

import "server-only";
import mongoose from "mongoose";
import { selectWorkTypesForPlatforms } from "@/lib/tasks/options";
import TaskOption from "@/models/TaskOption";

/**
 * ACTIVE work types linked to ANY of `platformIds` (platform option _ids), in
 * list order, each once; unlinked work types never appear (round 27 rule).
 * @param {string[]} platformIds
 * @returns {Promise<Array<{ id: string, label: string, icon: null, active: boolean, platforms: string[] }>>}
 */
export async function getWorkTypesForPlatforms(platformIds) {
  const ids = [...new Set((platformIds ?? []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return [];
  const docs = await TaskOption.find({ list: "work_type", active: true, platforms: { $in: ids } })
    .select("label order active platforms")
    .lean();
  return selectWorkTypesForPlatforms(docs, ids).map((o) => ({
    id: o._id.toString(),
    label: o.label,
    icon: null,
    active: !!o.active,
    platforms: o.platforms.map(String),
  }));
}
