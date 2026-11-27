"use server";

import { getProjectViewer } from "@/lib/projects/access";
import { countAllTasks } from "@/lib/tasks/allTasks";
import { parseAllTasks } from "@/lib/tasks/allTasksFilters";

/**
 * Filter modal "แสดงผล N งาน" (round 56): the live count for a PENDING state,
 * given as an All Tasks query string. Same visibility as the page (the loader
 * scopes to the viewer's projects); nothing is applied.
 * @param {string} query "?tab=…&type=…"
 * @param {"all" | "mine"} [scope] round 58: My Workspace counts only my tasks
 * @returns {Promise<{ ok: true, count: number } | { ok: false }>}
 */
export async function countAllTasksAction(query, scope = "all") {
  const viewer = await getProjectViewer();
  if (!viewer) return { ok: false };
  const f = parseAllTasks(new URLSearchParams(String(query ?? "").replace(/^\?/, "")), scope === "mine" ? "mine" : "all");
  return { ok: true, count: await countAllTasks(viewer, f) };
}
