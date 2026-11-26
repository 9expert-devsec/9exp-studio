"use server";

// Work Plan actions (round 47). Every export is a public POST endpoint: export
// ONLY the actions below. Rules are pure in lib/tasks/workplan.js (parseEntry,
// checkPlans, checkLogs, workPlanPeople, canWriteFor) — the dialogs run the same
// checks; everything is re-checked here against the DB.
//
// Scope: viewer from the DB, project via findViewableProject (not cancelled),
// content within it, task within both. Writers: the Work Plan person themself,
// or full access (Manager / superadmin) on their behalf (onBehalf: true).
// Activity only (no notifications). Saving a log never changes plans or status.

import mongoose from "mongoose";
import { findContentTask, findProjectContent, findViewableProject, getProjectViewer } from "@/lib/projects/access";
import { logActivity } from "@/lib/tasks/activity";
import {
  MAX_CARDS,
  NOTE_MAX,
  bangkokDay,
  canWriteFor,
  checkLogs,
  checkPlans,
  entryMinutes,
  parseEntry,
  workPlanPeople,
} from "@/lib/tasks/workplan";
import Task from "@/models/Task";
import TaskWorkEntry from "@/models/TaskWorkEntry";
import User from "@/models/User";

const fail = (error, fieldErrors) => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });
const str = (v) => (typeof v === "string" ? v : "");
const SIGNED_OUT = "Your session has expired. Please sign in again.";
const FIX = "แก้ไขรายการที่มีปัญหาก่อนบันทึก";

const json = (v, fallback) => {
  try {
    return JSON.parse(str(v));
  } catch {
    return fallback;
  }
};

/** Viewer + project + content + task + the person being written for (allowed), or { error }. */
async function loadScope(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return { error: SIGNED_OUT };
  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return { error: "That project no longer exists." };
  if (project.status === "cancelled") return { error: "This project is cancelled. Reopen it to change its tasks." };
  const content = await findProjectContent(project, str(formData.get("contentId")));
  if (!content) return { error: "That content item no longer exists." };
  const task = await findContentTask(project, content, str(formData.get("taskId")));
  if (!task) return { error: "That task no longer exists." };
  const person = str(formData.get("person"));
  const who = canWriteFor(person, { viewerId: viewer.idStr, fullAccess: !!viewer.isAdmin, people: workPlanPeople(task) });
  if (!who.ok) return { error: "บันทึกได้เฉพาะแผน/เวลาของตัวเอง (หรือ Manager บันทึกแทน)" };
  const user = await User.findById(person).select("name").lean();
  return { viewer, project, task, person, personName: user?.name ?? "Unknown", onBehalf: who.onBehalf };
}

/** The person's saved entries of `kind` on `dates`, on EVERY task, with the task titles. */
async function personEntries(person, kind, dates) {
  if (!dates.length) return [];
  const docs = await TaskWorkEntry.find({ person, kind, date: { $in: dates } }).lean();
  const tasks = docs.length ? await Task.find({ _id: { $in: [...new Set(docs.map((d) => String(d.task)))] } }).select("title").lean() : [];
  const title = new Map(tasks.map((t) => [String(t._id), t.title]));
  return docs.map((d) => ({
    id: String(d._id),
    taskId: String(d.task),
    taskTitle: title.get(String(d.task)) ?? "Unknown task",
    date: d.date,
    mode: d.mode,
    start: d.start,
    end: d.end,
    minutes: d.minutes,
  }));
}

/**
 * Dialog checks need the person's other entries: their plans / logs on `dates`
 * across every task (only for someone allowed to write for that person).
 */
export async function loadWorkContextAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const kind = str(formData.get("kind")) === "log" ? "log" : "plan";
  const dates = [...new Set((json(formData.get("dates"), []) ?? []).map(str))].filter(Boolean).slice(0, MAX_CARDS);
  return { ok: true, entries: await personEntries(scope.person, kind, dates) };
}

const dueDay = (task) => bangkokDay(task.dueAt);
const base = (scope) => ({ task: scope.task._id, project: scope.project._id, actor: scope.viewer.id, type: "work_plan" });
const act = (scope, data) => ({ ...base(scope), data: { personName: scope.personName, onBehalf: scope.onBehalf, ...data } });

/**
 * Add plans (several cards, all-or-nothing) or edit ONE plan (a card with `id`).
 * Form: projectId, contentId, taskId, person, cards (JSON [{ id?, date, mode, start, end, hours }]).
 * Errors: fieldErrors { "<card index>": message }.
 */
export async function savePlansAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const raw = json(formData.get("cards"), []);
  if (!Array.isArray(raw) || !raw.length) return fail("เพิ่มอย่างน้อย 1 แผน");
  if (raw.length > MAX_CARDS) return fail(`ไม่เกิน ${MAX_CARDS} แผนต่อครั้ง`);
  const editId = raw.find((c) => c?.id) ? str(raw[0]?.id) : "";
  if (editId && raw.length !== 1) return fail("แก้ไขได้ครั้งละ 1 แผน");

  const errors = {};
  const cards = raw.map((c, i) => {
    const p = parseEntry(c, { kind: "plan" });
    if (p.error) errors[i] = p.error;
    return p.value ? { ...p.value, ...(editId ? { id: editId } : {}) } : null;
  });
  if (Object.keys(errors).length) return fail(FIX, errors);

  let editing = null;
  if (editId) {
    if (!mongoose.isValidObjectId(editId)) return fail("This plan no longer exists.");
    editing = await TaskWorkEntry.findOne({ _id: editId, task: scope.task._id, person: scope.person, kind: "plan" }).lean();
    if (!editing) return fail("This plan no longer exists.");
  }

  const existing = await personEntries(scope.person, "plan", [...new Set(cards.map((c) => c.date))]);
  const checks = checkPlans(cards, { taskId: String(scope.task._id), existing, dueDate: dueDay(scope.task) });
  checks.forEach((c, i) => c.error && (errors[i] = c.error));
  if (Object.keys(errors).length) return fail(FIX, errors);

  const fields = (c) => ({ date: c.date, mode: c.mode, start: c.start, end: c.end, minutes: c.minutes });
  const entries = [];
  if (editing) {
    const c = cards[0];
    const moved = c.date !== editing.date;
    await TaskWorkEntry.updateOne(
      { _id: editing._id },
      {
        $set: {
          ...fields(c),
          ...(moved && !editing.movedFrom ? { movedFrom: editing.date } : {}),
          onBehalf: scope.onBehalf,
          updatedBy: scope.viewer.id,
        },
      }
    );
    entries.push(moved ? act(scope, { action: "plan_moved", from: editing.date, date: c.date }) : act(scope, { action: "plan_edited", date: c.date }));
  } else {
    await TaskWorkEntry.insertMany(
      cards.map((c) => ({
        ...fields(c),
        task: scope.task._id,
        project: scope.project._id,
        person: scope.person,
        kind: "plan",
        onBehalf: scope.onBehalf,
        createdBy: scope.viewer.id,
      }))
    );
    entries.push(act(scope, { action: "plans_added", count: cards.length, minutes: cards.reduce((t, c) => t + entryMinutes(c), 0) }));
  }
  const pastDue = Math.max(0, ...checks.map((c) => c.dueDays));
  if (pastDue) entries.push(act(scope, { action: "plan_past_due", days: pastDue }));
  await logActivity(entries);
  return { ok: true };
}

/**
 * Log time on ONE date: several ranges, or hours only. Edit = ONE entry (`id`).
 * Form: projectId, contentId, taskId, person, id?, date, mode, rows (JSON [{ start, end }]), hours, note.
 * Errors: fieldErrors { date | hours | "<row index>": message }.
 */
export async function saveLogsAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const today = bangkokDay(Date.now());
  const date = str(formData.get("date"));
  const mode = str(formData.get("mode")) === "hours" ? "hours" : "range";
  const note = str(formData.get("note")).trim();
  if (note.length > NOTE_MAX) return fail(FIX, { note: `ไม่เกิน ${NOTE_MAX} ตัวอักษร` });
  const editId = str(formData.get("id"));

  const rawRows = mode === "hours" ? [{ date, mode, hours: formData.get("hours") }] : (json(formData.get("rows"), []) ?? []).map((r) => ({ date, mode, start: r?.start, end: r?.end }));
  if (!rawRows.length) return fail("เพิ่มช่วงเวลาอย่างน้อย 1 ช่วง");
  if (rawRows.length > 12) return fail("ไม่เกิน 12 ช่วงต่อครั้ง");
  if (editId && rawRows.length !== 1) return fail("แก้ไขได้ครั้งละ 1 รายการ");

  const errors = {};
  const rows = rawRows.map((r, i) => {
    const p = parseEntry(r, { kind: "log", today });
    if (p.error) errors[p.field === "date" ? "date" : mode === "hours" ? "hours" : i] = p.error;
    return p.value ? { ...p.value, ...(editId ? { id: editId } : {}) } : null;
  });
  if (Object.keys(errors).length) return fail(FIX, errors);

  let editing = null;
  if (editId) {
    if (!mongoose.isValidObjectId(editId)) return fail("This time log no longer exists.");
    editing = await TaskWorkEntry.findOne({ _id: editId, task: scope.task._id, person: scope.person, kind: "log" }).lean();
    if (!editing) return fail("This time log no longer exists.");
  }

  const existing = await personEntries(scope.person, "log", [date]);
  checkLogs(rows, { existing }).forEach((e, i) => e && (errors[mode === "hours" ? "hours" : i] = e));
  if (Object.keys(errors).length) return fail(FIX, errors);

  const fields = (r) => ({ date: r.date, mode: r.mode, start: r.start, end: r.end, minutes: r.minutes, note });
  if (editing) {
    await TaskWorkEntry.updateOne({ _id: editing._id }, { $set: { ...fields(rows[0]), onBehalf: scope.onBehalf, updatedBy: scope.viewer.id } });
    await logActivity(act(scope, { action: "log_edited", date }));
  } else {
    await TaskWorkEntry.insertMany(
      rows.map((r) => ({
        ...fields(r),
        task: scope.task._id,
        project: scope.project._id,
        person: scope.person,
        kind: "log",
        onBehalf: scope.onBehalf,
        createdBy: scope.viewer.id,
      }))
    );
    await logActivity(act(scope, { action: "log_added", date, minutes: rows.reduce((t, r) => t + r.minutes, 0) }));
  }
  return { ok: true };
}

/** Delete ONE plan or log (behind the confirm modal). Form: projectId, contentId, taskId, person, id. */
export async function deleteWorkEntryAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const id = str(formData.get("id"));
  if (!mongoose.isValidObjectId(id)) return fail("This entry no longer exists.");
  const entry = await TaskWorkEntry.findOneAndDelete({ _id: id, task: scope.task._id, person: scope.person }).lean();
  if (!entry) return fail("This entry no longer exists.");
  await logActivity(act(scope, { action: entry.kind === "plan" ? "plan_deleted" : "log_deleted", date: entry.date }));
  return { ok: true };
}
