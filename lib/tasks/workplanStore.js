// Work Plan (round 47) — DB side of the Task Detail tab. Server only. Rules:
// lib/tasks/workplan.js; writes: app/(app)/projects/workplan-actions.js.

import "server-only";
import { START_STATUS, bangkokDay, canWriteFor, formerPeople, hasStarted, notStartedMessage, workPlanPeople } from "@/lib/tasks/workplan";
import TaskActivity from "@/models/TaskActivity";
import TaskWorkEntry from "@/models/TaskWorkEntry";
import User from "@/models/User";

const idOf = (v) => (v ? String(v) : "");

/** Former Work Plan people of a task: they have entries here but aren't its people any more (round 50). */
export async function taskFormers(task) {
  const persons = await TaskWorkEntry.distinct("person", { task: task._id });
  return formerPeople(workPlanPeople(task), persons.map(idOf));
}

/**
 * Has the task started (round 50: log time is allowed only then)? Reached = a
 * stored start stamp (Task.flow) or an Activity entry INTO the start status;
 * lib/tasks/workplan.js hasStarted adds "a working status at / after it".
 */
export async function taskStarted(task) {
  const start = START_STATUS[task.type];
  if (!start || hasStarted(task.type, { status: task.status })) return true;
  const stamp = task.type === "photo" ? task.flow?.shotAt : task.flow?.startedAt;
  if (stamp) return true;
  return !!(await TaskActivity.exists({ task: task._id, type: "status_changed", "data.to": start }));
}

/**
 * Work Plan tab data: the task's people (main assignee first) + former people
 * who still have entries here (round 50 handover; `former: true`, read-only
 * except for Manager / superadmin), which of them this viewer may write for /
 * add to, the default person, every plan / log on this task, whether log time
 * is open yet (`started`), and the task's start / due day + today (Bangkok).
 */
export async function loadWorkPlan(task, { viewer, readOnly, projectOpen }) {
  const people = workPlanPeople(task);
  const docs = await TaskWorkEntry.find({ task: task._id }).sort({ date: 1, start: 1 }).lean();
  const formers = formerPeople(people, docs.map((e) => idOf(e.person)));
  const everyone = [...people, ...formers];
  const [users, started] = await Promise.all([
    everyone.length ? User.find({ _id: { $in: everyone } }).select("name avatar.url").lean() : [],
    taskStarted(task),
  ]);
  const byId = new Map(users.map((u) => [idOf(u._id), u]));
  const fullAccess = !!viewer?.isAdmin;
  const rights = (id) => (readOnly || !projectOpen ? { ok: false } : canWriteFor(id, { viewerId: viewer?.idStr, fullAccess, people, formers }));
  const row = (id, former) => ({ id, name: byId.get(id)?.name ?? "Unknown account", avatarUrl: byId.get(id)?.avatar?.url ?? null, former });
  return {
    people: [...people.map((id) => row(id, false)), ...formers.map((id) => row(id, true))],
    // Edit / delete existing entries.
    writable: everyone.filter((id) => rights(id).ok),
    // Add new plans / logs: current people only.
    canAdd: people.filter((id) => rights(id).ok),
    started,
    startMessage: notStartedMessage(task.type),
    defaultPerson: people.includes(viewer?.idStr) ? viewer.idStr : (people[0] ?? formers[0] ?? null),
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
