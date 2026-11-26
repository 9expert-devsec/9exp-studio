// Review cycles (round 46) — pure rules (no DB, no React). Shared by the review
// server actions, the Task Detail read model, the client and node checks.
//
// A type with REVIEW_SECTIONS can be "submitted for review": ONE ลิงก์รีวิว shared
// by every reviewer, one section per review part:
//   clip     Present (details.contentReviewer, review_content)
//            Video   (details.videoReviewer,   review_video)
//   graphic  Design  (details.designReviewer,  review_design)
// Statuses (same keys for both types): waiting_review (รอตรวจ / รอตรวจสอบ) while a
// cycle is open; revising (แก้ไข) when any section failed; done (เสร็จสมบูรณ์)
// when all passed — decided ONLY by cycleOutcome(), once every section of the
// cycle has a verdict.
//
// A cycle (models/TaskReview.js): { cycleNo, link, note, linkUpdated, resubmit,
// submittedBy, submittedAt, status: open|revision|passed|withdrawn, closedAt,
// sections: [{ key, reviewerId, verdict: pending|pass|fail, feedback, decidedBy,
// decidedAt, onBehalf, carriedOver, assignedAt }] }.
// Resubmit (from a "revision" cycle): passed sections are carried over as they
// were (carriedOver, never re-asked); only failed ones become pending again.

import { isHttpUrl } from "../projects/rules.js";

export const REVIEW_LINK_MAX = 2000;
export const REVIEW_NOTE_MAX = 2000;
export const REVIEW_FEEDBACK_MAX = 5000;
export const FAIL_NEEDS_FEEDBACK = "ระบุเหตุผลที่ไม่ผ่าน";

const SECTIONS = {
  clip: [
    { key: "present", label: "Present", reviewerField: "contentReviewer", roleLabel: "Content review" },
    { key: "video", label: "Video", reviewerField: "videoReviewer", roleLabel: "Video review" },
  ],
  graphic: [{ key: "design", label: "Design", reviewerField: "designReviewer", roleLabel: "Design review" }],
};

/** Status keys of the review flow (identical for clip and graphic). */
export const REVIEW_STATUS = { review: "waiting_review", revise: "revising", done: "done" };

/** Review sections of a type ([] = the type has no review). */
export const reviewSections = (type) => SECTIONS[type] ?? [];
export const isReviewType = (type) => reviewSections(type).length > 0;
export const sectionLabel = (type, key) => reviewSections(type).find((s) => s.key === key)?.label ?? key;

const idStr = (v) => (v ? String(v) : "");
const sameId = (a, b) => !!a && !!b && idStr(a) === idStr(b);

/**
 * THE outcome of a cycle — used by the verdict action AND the UI.
 * @returns {{ decided: boolean, result: null | "revision" | "passed", to: string | null,
 *             total: number, decidedCount: number, passed: number, failed: number }}
 *   decided=false while any section is pending, and always for a withdrawn cycle.
 */
export function cycleOutcome(cycle) {
  const sections = cycle?.sections ?? [];
  const passed = sections.filter((s) => s.verdict === "pass").length;
  const failed = sections.filter((s) => s.verdict === "fail").length;
  const base = { total: sections.length, decidedCount: passed + failed, passed, failed };
  if (!sections.length || cycle.status === "withdrawn" || passed + failed < sections.length) {
    return { decided: false, result: null, to: null, ...base };
  }
  const result = failed > 0 ? "revision" : "passed";
  return { decided: true, result, to: result === "revision" ? REVIEW_STATUS.revise : REVIEW_STATUS.done, ...base };
}

/**
 * Extra options for USER status moves (transitions.js allowedNextStatuses /
 * canTransition): out of รอตรวจ the way forward comes from the verdicts only.
 * Escape hatches (back, pause, cancel, override) stay. Moves INTO รอตรวจ are
 * offered but go through the Submit dialog (needsSubmit).
 */
export const reviewMoveOpts = (type) => ({ noForwardFrom: isReviewType(type) ? REVIEW_STATUS.review : null });

/** Does a user move to `to` have to go through Submit for Review? */
export const needsSubmit = (type, to) => isReviewType(type) && to === REVIEW_STATUS.review;

/** Is the latest cycle one to RESUBMIT (closed with failures)? */
export const isResubmit = (latest) => latest?.status === "revision";

/**
 * Check the posted submit form (pure). `reviewers`: { sectionKey: userId }.
 * `latest` = the task's latest cycle (resubmit when it is "revision": only failed
 * sections need / accept a reviewer). `eligible`: sectionKey → Set of user ids;
 * `stored`: sectionKey → the task's current reviewer id (an unchanged stored one
 * passes even if no longer eligible).
 * @returns {{ errors: Record<string,string> } | { values: { link, note, reviewers: Record<string,string> } }}
 */
export function validateSubmission(type, input, { latest = null, eligible = {}, stored = {} } = {}) {
  const errors = {};
  const link = String(input?.link ?? "").trim();
  if (!link) errors.link = "ใส่ลิงก์รีวิว";
  else if (link.length > REVIEW_LINK_MAX || !isHttpUrl(link)) errors.link = "ใส่ลิงก์แบบ http:// หรือ https:// ให้ครบ";
  const note = String(input?.note ?? "").trim();
  if (note.length > REVIEW_NOTE_MAX) errors.note = `ไม่เกิน ${REVIEW_NOTE_MAX} ตัวอักษร`;

  const locked = new Set(isResubmit(latest) ? latest.sections.filter((s) => s.verdict === "pass").map((s) => s.key) : []);
  const reviewers = {};
  for (const sec of reviewSections(type)) {
    if (locked.has(sec.key)) continue;
    const id = String(input?.reviewers?.[sec.key] ?? "");
    const field = `reviewer_${sec.key}`;
    if (!id) errors[field] = `เลือก Reviewer ส่วน ${sec.label}`;
    else if (!(sameId(id, stored[sec.key]) || eligible[sec.key]?.has(id))) errors[field] = `คนนี้ตรวจส่วน ${sec.label} ไม่ได้`;
    else reviewers[sec.key] = id;
  }
  if (Object.keys(errors).length) return { errors };
  return { values: { link, note, reviewers } };
}

/**
 * The new cycle for a submit / resubmit (pure; ids as given, dates = `now`).
 * @returns {object} cycle fields (status "open")
 */
export function buildCycle(type, { latest = null, lastCycleNo = latest?.cycleNo ?? 0, link, note, reviewers, submittedBy, now = new Date() }) {
  const resubmit = isResubmit(latest);
  const prev = new Map((latest?.sections ?? []).map((s) => [s.key, s]));
  const sections = reviewSections(type).map((sec) => {
    const p = prev.get(sec.key);
    if (resubmit && p?.verdict === "pass") return { ...p, carriedOver: true };
    return {
      key: sec.key,
      reviewerId: reviewers[sec.key],
      verdict: "pending",
      feedback: "",
      decidedBy: null,
      decidedAt: null,
      onBehalf: false,
      carriedOver: false,
      assignedAt: now,
    };
  });
  return {
    cycleNo: lastCycleNo + 1,
    link,
    note,
    resubmit,
    linkUpdated: resubmit && !!latest?.link && latest.link !== link,
    submittedBy,
    submittedAt: now,
    status: "open",
    closedAt: null,
    sections,
  };
}

/** Reviewer changes a submit makes on the Task: [{ key, field, roleLabel, from, to }]. */
export function reviewerChanges(type, reviewers, stored) {
  return reviewSections(type)
    .filter((sec) => sec.key in reviewers && !sameId(reviewers[sec.key], stored[sec.key]))
    .map((sec) => ({ key: sec.key, label: sec.label, field: sec.reviewerField, roleLabel: sec.roleLabel, from: idStr(stored[sec.key]) || null, to: reviewers[sec.key] }));
}

/**
 * May this viewer record a verdict on a section of an OPEN cycle?
 * The assigned reviewer, or full access (Manager / superadmin) on their behalf.
 * @returns {{ ok: false, reason: string } | { ok: true, onBehalf: boolean }}
 */
export function canRecordVerdict(cycle, sectionKey, { viewerId, fullAccess = false }) {
  if (cycle?.status !== "open") return { ok: false, reason: "รอบตรวจนี้ปิดแล้ว" };
  const s = (cycle.sections ?? []).find((x) => x.key === sectionKey);
  if (!s) return { ok: false, reason: "ไม่พบส่วนที่ต้องตรวจ" };
  if (s.verdict !== "pending") return { ok: false, reason: "ส่วนนี้ตรวจแล้ว" };
  if (sameId(s.reviewerId, viewerId)) return { ok: true, onBehalf: false };
  if (fullAccess) return { ok: true, onBehalf: true };
  return { ok: false, reason: "เฉพาะ Reviewer ของส่วนนี้ หรือ Manager ที่ตรวจได้" };
}

/** Verdict form check: pass | fail; fail needs feedback. */
export function validateVerdict(verdict, feedback) {
  const text = String(feedback ?? "").trim();
  if (verdict !== "pass" && verdict !== "fail") return { error: "เลือกผลตรวจ" };
  if (verdict === "fail" && !text) return { error: FAIL_NEEDS_FEEDBACK };
  if (text.length > REVIEW_FEEDBACK_MAX) return { error: `ไม่เกิน ${REVIEW_FEEDBACK_MAX} ตัวอักษร` };
  return { verdict, feedback: text };
}

/** Section keys of an open cycle this viewer may decide now (own first, then on-behalf). */
export function pendingForViewer(cycle, { viewerId, fullAccess = false }) {
  if (cycle?.status !== "open") return [];
  const pending = (cycle.sections ?? []).filter((s) => s.verdict === "pending");
  const own = pending.filter((s) => sameId(s.reviewerId, viewerId)).map((s) => s.key);
  const others = fullAccess ? pending.filter((s) => !sameId(s.reviewerId, viewerId)).map((s) => s.key) : [];
  return [...own, ...others];
}

/** Section card order: failed, then the viewer's pending ones, then the rest (stable). */
export function orderSections(sections, mine = []) {
  const rank = (s) => (s.verdict === "fail" ? 0 : mine.includes(s.key) ? 1 : 2);
  return [...sections].map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
}

/**
 * The Task Detail action for the review part of the flow (pure).
 *   status editing / any status a submit can start from → "submit" button
 *   waiting_review → "review" (the viewer's first decidable section) or hint only
 *   revising + latest cycle "revision" → "resubmit"
 * @param {{ status: string, open: object|null, latest: object|null, canSubmit: boolean, viewerId: string, fullAccess: boolean }} ctx
 * @returns {null | { button: null | { kind: "submit"|"resubmit"|"review", label: string, section?: string }, helper: string }}
 */
export function reviewAction(type, { status, open = null, latest = null, canSubmit = false, viewerId = "", fullAccess = false }) {
  if (!isReviewType(type)) return null;
  const names = (keys) => keys.map((k) => sectionLabel(type, k)).join(", ");
  if (status === REVIEW_STATUS.review) {
    if (!open) return { button: null, helper: "รอ Reviewer ตรวจ" };
    const mine = pendingForViewer(open, { viewerId, fullAccess });
    const pending = open.sections.filter((s) => s.verdict === "pending").map((s) => s.key);
    if (!mine.length) return { button: null, helper: `รอ Reviewer ตรวจ: ${names(pending)}` };
    const done = open.sections.filter((s) => s.verdict !== "pending").map((s) => s.key);
    const helper = [done.length ? `${names(done)} ตรวจแล้ว` : "", `รอคุณตรวจ ${names([mine[0]])}`].filter(Boolean).join(" · ");
    return { button: { kind: "review", label: `Review ${sectionLabel(type, mine[0])}`, section: mine[0] }, helper };
  }
  if (status === REVIEW_STATUS.revise && isResubmit(latest)) {
    const failed = latest.sections.filter((s) => s.verdict === "fail").map((s) => s.key);
    const passed = latest.sections.filter((s) => s.verdict === "pass").map((s) => s.key);
    const helper = `ส่งตรวจใหม่เฉพาะ: ${names(failed)}${passed.length ? ` · ${names(passed)} ผ่านแล้ว` : ""}`;
    return { button: canSubmit ? { kind: "resubmit", label: "Resubmit for Review" } : null, helper };
  }
  return null;
}
