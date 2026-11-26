"use server";

// Review cycle actions (round 46). Every export is a public POST endpoint:
// export ONLY the actions below. Rules are pure in lib/tasks/reviews.js
// (validateSubmission, buildCycle, canRecordVerdict, validateVerdict and THE
// outcome function cycleOutcome); status moves still go through
// lib/tasks/transitions.js canTransition.
//
// Scope: like task-actions.js — viewer from the DB, project via
// findViewableProject, content within it, task within both.
//   submit / resubmit  canChangeTaskStatus (the round-40/45 rule for the status button)
//   verdict            the section's reviewer, or full access on their behalf
// No notifications exist: Activity entries only.

import mongoose from "mongoose";
import { refresh } from "next/cache";
import {
  canChangeTaskStatus,
  findContentTask,
  findProjectContent,
  findViewableProject,
  getProjectViewer,
  taskEligibility,
} from "@/lib/projects/access";
import { recomputeRollups } from "@/lib/projects/progress";
import { canOverrideTaskStatus } from "@/lib/permissions";
import { logActivity } from "@/lib/tasks/activity";
import { latestCycle } from "@/lib/tasks/reviewStore";
import {
  REVIEW_STATUS,
  buildCycle,
  canRecordVerdict,
  cycleOutcome,
  isResubmit,
  isReviewType,
  reviewSections,
  reviewerChanges,
  sectionLabel,
  validateSubmission,
  validateVerdict,
} from "@/lib/tasks/reviews";
import { canTransition, taskHasRelatedAssets } from "@/lib/tasks/transitions";
import Role from "@/models/Role";
import Task from "@/models/Task";
import TaskReview from "@/models/TaskReview";
import User from "@/models/User";

const fail = (error, fieldErrors) => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });
const str = (v) => (typeof v === "string" ? v : "");
const idStr = (v) => (v ? String(v) : "");
const oid = (id) => new mongoose.Types.ObjectId(id);
const SIGNED_OUT = "Your session has expired. Please sign in again.";
const NOT_FOUND = "That task no longer exists.";
const PROJECT_CANCELLED = "This project is cancelled. Reopen it to change its tasks.";

async function loadScope(formData) {
  const viewer = await getProjectViewer();
  if (!viewer) return { error: SIGNED_OUT };
  const project = await findViewableProject(viewer, str(formData.get("projectId")));
  if (!project) return { error: "That project no longer exists." };
  const content = await findProjectContent(project, str(formData.get("contentId")));
  if (!content) return { error: "That content item no longer exists." };
  const task = await findContentTask(project, content, str(formData.get("taskId")));
  if (!task) return { error: NOT_FOUND };
  return { viewer, project, content, task };
}

/** The move into รอตรวจ for this viewer (canTransition with the same options as the status menu). */
const submitMove = (viewer, project, task) =>
  canTransition(task.type, task.status, REVIEW_STATUS.review, {
    canOverride: canOverrideTaskStatus(viewer, project),
    hasRelatedAssets: taskHasRelatedAssets(task),
    statusBeforeHold: task.statusBeforeHold ?? null,
  });

/** The cycle a submit continues from: the latest one, only while the task is at แก้ไข. */
const continuesFrom = (task, latest) => (task.status === REVIEW_STATUS.revise && isResubmit(latest) ? latest : null);

const storedReviewers = (task) =>
  Object.fromEntries(reviewSections(task.type).map((sec) => [sec.key, idStr(task.details?.[sec.reviewerField])]));

async function namesOf(ids) {
  const list = [...new Set(ids.filter(Boolean).map(String))];
  const users = list.length ? await User.find({ _id: { $in: list } }).select("name").lean() : [];
  return new Map(users.map((u) => [String(u._id), u.name]));
}

/**
 * Submit / Resubmit dialog data for one task (read only). Resubmit = the task is
 * at แก้ไข after a cycle with failures: passed sections are locked.
 * @returns {{ ok: true, form: { mode: "submit"|"resubmit", link: string, sections: object[] } } | { ok: false, error: string }}
 */
export async function loadReviewFormAction(projectId, contentId, taskId) {
  const fd = new FormData();
  fd.set("projectId", str(projectId));
  fd.set("contentId", str(contentId));
  fd.set("taskId", str(taskId));
  const scope = await loadScope(fd);
  if (scope.error) return fail(scope.error);
  const { viewer, project, task } = scope;
  if (!isReviewType(task.type)) return fail("This task type has no review.");
  if (!canChangeTaskStatus(viewer, project, task)) return fail("You can't submit this task for review.");

  const latest = await latestCycle(task._id);
  const prev = continuesFrom(task, latest);
  const [elig, roles] = await Promise.all([taskEligibility(project, task.type), Role.find().select("key name").lean()]);
  const roleName = new Map(roles.map((r) => [r.key, r.name]));
  const row = (u, extra = {}) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    avatarUrl: u.avatar?.url ?? null,
    roleLabel: roleName.get(u.role) ?? null,
    ...extra,
  });
  const stored = storedReviewers(task);
  const prevSections = new Map((prev?.sections ?? []).map((s) => [s.key, s]));
  // Stored / locked people who aren't in the eligible lists still need a row.
  const extraIds = [...Object.values(stored), ...[...prevSections.values()].map((s) => idStr(s.reviewerId))].filter(
    (id) => id && !elig.people.some((u) => String(u._id) === id)
  );
  const extras = extraIds.length ? await User.find({ _id: { $in: extraIds } }).select("name email role avatar").lean() : [];
  const anyone = (id) => {
    const u = elig.people.find((p) => String(p._id) === id) ?? extras.find((p) => String(p._id) === id);
    return u ? row(u) : { id, name: "Unknown user", email: null, avatarUrl: null, roleLabel: null };
  };

  const sections = reviewSections(task.type).map((sec) => {
    const p = prevSections.get(sec.key);
    if (prev && p?.verdict === "pass") {
      return { key: sec.key, label: sec.label, locked: true, person: anyone(idStr(p.reviewerId)) };
    }
    const set = elig[sec.reviewerField] ?? new Set();
    const people = elig.people.filter((u) => set.has(String(u._id))).map((u) => row(u));
    const current = stored[sec.key];
    if (current && !people.some((x) => x.id === current)) people.push({ ...anyone(current), ineligible: true });
    return { key: sec.key, label: sec.label, locked: false, current, people };
  });
  return { ok: true, form: { mode: prev ? "resubmit" : "submit", link: prev?.link ?? "", sections } };
}

/**
 * Submit (or Resubmit) for review: ONE ลิงก์รีวิว, a reviewer per section that is
 * reviewed this time (changes are written back to the Task and logged), the task
 * → รอตรวจ / รอตรวจสอบ, a new open cycle.
 * Form: projectId, contentId, taskId, link, note, reviewers (JSON { sectionKey: userId }).
 */
export async function submitReviewAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const { viewer, project, content, task } = scope;
  if (!isReviewType(task.type)) return fail("This task type has no review.");
  if (!canChangeTaskStatus(viewer, project, task)) {
    return fail(project.status === "cancelled" ? PROJECT_CANCELLED : "Only the task's creator or assignee, the project owner or an admin can submit it.");
  }
  const move = submitMove(viewer, project, task);
  if (!move.ok) return fail(move.reason);

  const latest = await latestCycle(task._id);
  if (latest?.status === "open") return fail("This task already has an open review. Reload and try again.");
  const prev = continuesFrom(task, latest);

  let reviewersIn = {};
  try {
    reviewersIn = JSON.parse(str(formData.get("reviewers")) || "{}");
  } catch {
    reviewersIn = {};
  }
  const elig = await taskEligibility(project, task.type);
  const eligible = Object.fromEntries(reviewSections(task.type).map((sec) => [sec.key, elig[sec.reviewerField] ?? new Set()]));
  const stored = storedReviewers(task);
  const checked = validateSubmission(
    task.type,
    { link: str(formData.get("link")), note: str(formData.get("note")), reviewers: reviewersIn },
    { latest: prev, eligible, stored }
  );
  if (checked.errors) return fail("Please fix the highlighted fields.", checked.errors);
  const { link, note, reviewers } = checked.values;

  const now = new Date();
  const cycle = buildCycle(task.type, { latest: prev, lastCycleNo: latest?.cycleNo ?? 0, link, note, reviewers, submittedBy: viewer.id, now });
  const changes = reviewerChanges(task.type, reviewers, stored);

  // Status first (atomic on the current status), then the cycle.
  const set = { status: REVIEW_STATUS.review, statusBeforeHold: null, updatedBy: viewer.id };
  for (const c of changes) set[`details.${c.field}`] = oid(c.to);
  const res = await Task.updateOne({ _id: task._id, content: content._id, project: project._id, status: task.status }, { $set: set });
  if (!res.matchedCount) return fail("This task's status just changed. Reload and try again.");
  await TaskReview.create({
    ...cycle,
    task: task._id,
    project: project._id,
    sections: cycle.sections.map((s) => ({ ...s, reviewerId: s.reviewerId ? oid(String(s.reviewerId)) : null })),
  });

  const names = await namesOf(cycle.sections.map((s) => s.reviewerId));
  const base = { task: task._id, project: project._id, actor: viewer.id };
  const reviewed = cycle.sections.filter((s) => !s.carriedOver);
  await logActivity([
    ...changes.map((c) => ({ ...base, type: "reviewer_changed", data: { role: `${c.label} reviewer`, section: c.key, from: c.from, to: c.to } })),
    {
      ...base,
      type: "review_submitted",
      data: {
        cycleNo: cycle.cycleNo,
        link,
        from: task.status,
        to: REVIEW_STATUS.review,
        resubmit: cycle.resubmit,
        sections: reviewed.map((s) => sectionLabel(task.type, s.key)),
        reviewers: reviewed.map((s) => ({ section: sectionLabel(task.type, s.key), name: names.get(String(s.reviewerId)) ?? "Unknown" })),
      },
    },
  ]);

  await recomputeRollups({ projectId: project._id, contentId: content._id });
  refresh();
  return { ok: true };
}

/**
 * Record ONE section's verdict (ผ่าน / ไม่ผ่าน + feedback; final). When every
 * section of the cycle is decided, cycleOutcome() picks the task's status
 * (แก้ไข / เสร็จสมบูรณ์) and the System moves it (a legal arrow from รอตรวจ).
 * Form: projectId, contentId, taskId, cycleId, section, verdict, feedback.
 */
export async function recordVerdictAction(formData) {
  const scope = await loadScope(formData);
  if (scope.error) return fail(scope.error);
  const { viewer, project, content, task } = scope;
  if (project.status === "cancelled") return fail(PROJECT_CANCELLED);
  const cycleId = str(formData.get("cycleId"));
  if (!mongoose.isValidObjectId(cycleId)) return fail("This review no longer exists. Reload and try again.");
  const cycle = await TaskReview.findOne({ _id: cycleId, task: task._id }).lean();
  if (!cycle) return fail("This review no longer exists. Reload and try again.");

  const section = str(formData.get("section"));
  const who = canRecordVerdict(cycle, section, { viewerId: viewer.idStr, fullAccess: !!viewer.isAdmin });
  if (!who.ok) return fail(who.reason);
  const v = validateVerdict(str(formData.get("verdict")), str(formData.get("feedback")));
  if (v.error) return fail(v.error, { feedback: v.error });

  const now = new Date();
  const res = await TaskReview.updateOne(
    { _id: cycle._id, status: "open", sections: { $elemMatch: { key: section, verdict: "pending" } } },
    {
      $set: {
        "sections.$.verdict": v.verdict,
        "sections.$.feedback": v.feedback,
        "sections.$.decidedBy": viewer.id,
        "sections.$.decidedAt": now,
        "sections.$.onBehalf": who.onBehalf,
      },
    }
  );
  if (!res.modifiedCount) return fail("This section was just reviewed. Reload to see the result.");

  const reviewerId = cycle.sections.find((s) => s.key === section)?.reviewerId;
  const reviewerName = who.onBehalf ? ((await namesOf([reviewerId])).get(idStr(reviewerId)) ?? "Unknown") : "";
  await logActivity({
    task: task._id,
    project: project._id,
    actor: viewer.id,
    type: "review_verdict",
    data: { cycleNo: cycle.cycleNo, section: sectionLabel(task.type, section), verdict: v.verdict, feedback: v.feedback, reviewerName, onBehalf: who.onBehalf },
  });

  // Every section decided → close the cycle and move the task (System).
  const fresh = await TaskReview.findById(cycle._id).lean();
  const outcome = cycleOutcome(fresh);
  if (outcome.decided) {
    const closed = await TaskReview.updateOne({ _id: cycle._id, status: "open" }, { $set: { status: outcome.result, closedAt: now } });
    const legal = canTransition(task.type, REVIEW_STATUS.review, outcome.to);
    if (closed.modifiedCount && legal.ok) {
      const moved = await Task.updateOne(
        { _id: task._id, project: project._id, status: REVIEW_STATUS.review },
        { $set: { status: outcome.to, statusBeforeHold: null, updatedBy: null } }
      );
      if (moved.matchedCount) {
        await logActivity({
          task: task._id,
          project: project._id,
          actor: null,
          type: "status_changed",
          data: { from: REVIEW_STATUS.review, to: outcome.to, review: { cycleNo: cycle.cycleNo, result: outcome.result } },
        });
        await recomputeRollups({ projectId: project._id, contentId: content._id });
      }
    }
  }
  refresh();
  return { ok: true, outcome: outcome.decided ? outcome.result : null };
}
