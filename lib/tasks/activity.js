// Task activity log — writes + the read model for the Activity tab. Server only.
//
// Writes come ONLY from the task/content server actions, AFTER their main write;
// a failed log write is caught and console.error'd (it must never break the
// action). Reorders are not logged. Entries are deleted with their task.

import "server-only";
import { diffTask } from "@/lib/tasks/activityDiff";
import { peopleLine } from "@/lib/tasks/production";
import { statusInfo } from "@/lib/tasks/types";
import { formatTaskDateTime } from "@/lib/projects/format";
import TaskActivity from "@/models/TaskActivity";
import User from "@/models/User";

const idOf = (v) => (v ? v.toString() : "");
export const ACTIVITY_PAGE = 30;

/** Insert entries ([{ task, project, actor, type, data }]); never throws. */
export async function logActivity(entries) {
  const list = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
  if (!list.length) return;
  try {
    await TaskActivity.insertMany(list, { ordered: false });
  } catch (err) {
    console.error(`[activity] log failed (${list.map((e) => e.type).join(",")}): ${err?.message ?? "unknown error"}`);
  }
}

/**
 * Entries for an Edit (before = stored task, after = the values just written).
 * `names`: person key → display name, for Production's people_changed (names are
 * stored in the entry, so the line still reads right after a rename/delete).
 */
export function editEntries(before, after, { actor, names = new Map() }) {
  const base = { task: before._id, project: before.project, actor };
  const d = diffTask(before, after, before.type);
  const nameOf = (k) => names.get(k) ?? "Unknown";
  return [
    d.updatedFields.length ? { ...base, type: "updated", data: { fields: d.updatedFields } } : null,
    d.assignee ? { ...base, type: "assignee_changed", data: d.assignee } : null,
    ...d.reviewers.map((r) => ({ ...base, type: "reviewer_changed", data: r })),
    d.assets ? { ...base, type: "assets_changed", data: d.assets } : null,
    ...d.people.map((p) => ({
      ...base,
      type: "people_changed",
      data: { role: p.role, added: p.added.map(nameOf), removed: p.removed.map(nameOf) },
    })),
  ].filter(Boolean);
}

/** Person keys an Edit's people_changed entries need names for. */
export const editPeopleKeys = (before, after) =>
  diffTask(before, after, before.type).people.flatMap((p) => [...p.added, ...p.removed]);

/** Delete every entry of these tasks (task / content delete); never throws. */
export async function deleteActivity(taskIds) {
  if (!taskIds.length) return;
  try {
    await TaskActivity.deleteMany({ task: { $in: taskIds } });
  } catch (err) {
    console.error(`[activity] delete failed: ${err?.message ?? "unknown error"}`);
  }
}

// ── Read model ────────────────────────────────────────────────────────────

/** Filter groups for the "All Activities" dropdown. */
export const ACTIVITY_FILTERS = {
  all: null,
  status: ["status_changed"],
  edits: ["created", "updated"],
  people: ["assignee_changed", "reviewer_changed", "people_changed"],
  assets: ["assets_changed"],
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One entry → what the timeline shows (title, one-line description, when, who). */
function entryView(e, taskType, names) {
  const name = (id) => (id ? (names.get(idOf(id)) ?? "Unknown") : "Nobody");
  const d = e.data ?? {};
  let title = "Updated";
  let description = "";
  switch (e.type) {
    case "created":
      title = "Task created";
      description = d.duplicatedFrom ? `Duplicated from “${d.duplicatedFrom}”.` : "Task has been created.";
      break;
    case "status_changed":
      if (d.auto) {
        // Round 45: System move (Clip source-ready, lib/tasks/sourceReady.js).
        title = "Source ready";
        description = `อัตโนมัติจาก Production "${d.auto.productionTitle ?? ""}" ที่เสร็จแล้ว`;
        break;
      }
      title = d.override
        ? "Status changed (override)"
        : taskType === "clip" && d.from === "waiting_edit" && d.to === "editing"
          ? "Editing started" // the entry's time IS the recorded start time
          : "Status changed";
      description = `${statusInfo(taskType, d.from).label || "—"} → ${statusInfo(taskType, d.to).label || "—"}${d.override ? " (override)" : ""}`;
      break;
    case "updated":
      title = "Task updated";
      description = `Changed: ${(d.fields ?? []).join(", ")}`;
      break;
    case "assignee_changed":
      title =
        taskType === "article"
          ? "Writer changed"
          : taskType === "photo"
            ? "Camera Man changed"
            : taskType === "production"
              ? "Main videographer changed"
              : "Assignee changed";
      description = `${name(d.from)} → ${name(d.to)}`;
      break;
    case "people_changed":
      title = `${d.role ?? "People"}s changed`;
      description = peopleLine(d);
      break;
    case "reviewer_changed":
      title = `${d.role ?? "Reviewer"} changed`;
      description = `${name(d.from)} → ${name(d.to)}`;
      break;
    case "assets_changed":
      title = "Related assets changed";
      description = [d.added ? `${plural(d.added, "asset")} added` : "", d.removed ? `${plural(d.removed, "asset")} removed` : ""]
        .filter(Boolean)
        .join(" · ");
      break;
    default:
      break;
  }
  return {
    id: idOf(e._id),
    type: e.type,
    title,
    description,
    atLabel: formatTaskDateTime(e.createdAt),
    at: new Date(e.createdAt).toISOString(),
    actorName: e.actor ? name(e.actor) : "System",
  };
}

/**
 * The latest status change of a task (Task Detail "Current Status" context
 * line), or null when its status never changed.
 * @returns {Promise<null | { at: Date, actorName: string, auto: { productionTitle: string } | null }>}
 */
export async function latestStatusChange(task) {
  const e = await TaskActivity.findOne({ task: task._id, type: "status_changed" }).sort({ createdAt: -1, _id: -1 }).lean();
  if (!e) return null;
  const user = e.actor ? await User.findById(e.actor).select("name").lean() : null;
  return {
    at: e.createdAt,
    actorName: e.actor ? (user?.name ?? "Unknown") : "System",
    auto: e.data?.auto ? { productionTitle: String(e.data.auto.productionTitle ?? "") } : null,
  };
}

/**
 * One page of a task's activity, newest first.
 * @param {{ _id: unknown, type: string }} task
 * @param {{ filter?: string, cursor?: { at: string, id: string } | null }} [opts]
 * @returns {Promise<{ entries: object[], nextCursor: { at: string, id: string } | null }>}
 */
export async function loadActivityPage(task, { filter = "all", cursor = null } = {}) {
  const query = { task: task._id };
  const types = ACTIVITY_FILTERS[filter] ?? null;
  if (types) query.type = { $in: types };
  if (cursor?.at && /^[a-f0-9]{24}$/i.test(cursor.id ?? "")) {
    const at = new Date(cursor.at);
    if (!Number.isNaN(at.getTime())) query.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: cursor.id } }];
  }
  const docs = await TaskActivity.find(query).sort({ createdAt: -1, _id: -1 }).limit(ACTIVITY_PAGE + 1).lean();
  const page = docs.slice(0, ACTIVITY_PAGE);

  const ids = new Set();
  for (const e of page) {
    if (e.actor) ids.add(idOf(e.actor));
    if (e.type === "assignee_changed" || e.type === "reviewer_changed") {
      if (e.data?.from) ids.add(idOf(e.data.from));
      if (e.data?.to) ids.add(idOf(e.data.to));
    }
  }
  const users = ids.size ? await User.find({ _id: { $in: [...ids].filter(Boolean) } }).select("name").lean() : [];
  const names = new Map(users.map((u) => [idOf(u._id), u.name]));

  const last = page.at(-1);
  return {
    entries: page.map((e) => entryView(e, task.type, names)),
    nextCursor: docs.length > ACTIVITY_PAGE && last ? { at: new Date(last.createdAt).toISOString(), id: idOf(last._id) } : null,
  };
}
