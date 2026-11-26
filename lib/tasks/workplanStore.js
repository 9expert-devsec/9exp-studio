// Work Plan (round 47) — DB side of the Task Detail tab. Server only. Rules:
// lib/tasks/workplan.js; writes: app/(app)/projects/workplan-actions.js.

import "server-only";
import { bangkokDay, canWriteFor, workPlanPeople } from "@/lib/tasks/workplan";
import TaskWorkEntry from "@/models/TaskWorkEntry";
import User from "@/models/User";

const idOf = (v) => (v ? String(v) : "");

/**
 * Work Plan tab data: the task's people (main assignee first), which of them this
 * viewer may write for, the default person, every plan / log of those people on
 * this task, and the task's start / due day + today (Bangkok).
 * Entries of someone who is no longer a Work Plan person are not shown.
 */
export async function loadWorkPlan(task, { viewer, readOnly, projectOpen }) {
  const people = workPlanPeople(task);
  const [users, docs] = await Promise.all([
    people.length ? User.find({ _id: { $in: people } }).select("name avatar.url").lean() : [],
    people.length ? TaskWorkEntry.find({ task: task._id, person: { $in: people } }).sort({ date: 1, start: 1 }).lean() : [],
  ]);
  const byId = new Map(users.map((u) => [idOf(u._id), u]));
  const fullAccess = !!viewer?.isAdmin;
  const writable =
    readOnly || !projectOpen ? [] : people.filter((id) => canWriteFor(id, { viewerId: viewer?.idStr, fullAccess, people }).ok);
  return {
    people: people.map((id) => ({ id, name: byId.get(id)?.name ?? "Unknown account", avatarUrl: byId.get(id)?.avatar?.url ?? null })),
    writable,
    defaultPerson: people.includes(viewer?.idStr) ? viewer.idStr : (people[0] ?? null),
    entries: docs.map((e) => ({
      id: idOf(e._id),
      person: idOf(e.person),
      kind: e.kind,
      date: e.date,
      mode: e.mode,
      start: e.start ?? null,
      end: e.end ?? null,
      minutes: e.minutes,
      note: e.note ?? "",
      movedFrom: e.movedFrom ?? null,
      onBehalf: !!e.onBehalf,
    })),
    startDate: bangkokDay(task.startAt),
    dueDate: bangkokDay(task.dueAt),
    today: bangkokDay(Date.now()),
  };
}

/** Delete every plan / log of these tasks (task / content delete); never throws. */
export async function deleteWorkEntries(taskIds) {
  if (!taskIds.length) return;
  try {
    await TaskWorkEntry.deleteMany({ task: { $in: taskIds } });
  } catch (err) {
    console.error(`[workplan] delete failed: ${err?.message ?? "unknown error"}`);
  }
}
