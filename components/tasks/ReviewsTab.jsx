"use client";

// Task Detail → Reviews (round 46, Figma 341:1293 / 341:2231 / 341:2913).
// Data: lib/projects/queries.js reviewPanelData (panel.review). Top to bottom:
// current cycle (header + chip, ลิงก์รีวิว card, note, "ผลตรวจรายส่วน" section
// cards — the viewer's decidable ones carry the verdict form), the revision hint,
// then closed cycles ("ผลตรวจครั้งก่อน", collapsed). Verdicts go through
// review-actions.js recordVerdictAction; the task's status follows from
// lib/tasks/reviews.js cycleOutcome on the server.

import { useEffect, useState, useTransition } from "react";
import { ChevronRight, Clock3, ExternalLink, Info, Link2, Loader2, MessageSquareText } from "lucide-react";
import { recordVerdictAction } from "@/app/(app)/projects/review-actions";
import { invalidateTaskPanel } from "@/components/tasks/panelCache";
import { SECTION_ICON } from "@/components/tasks/ReviewDialog";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { FAIL_NEEDS_FEEDBACK } from "@/lib/tasks/reviews";

const CYCLE_CHIP = {
  open: { text: "กำลังตรวจ", tone: "bg-brand-500/15 text-accent-fg" },
  revision: { text: "ต้องแก้ไข", tone: "bg-warning/15 text-warning" },
  passed: { text: "✓ ผ่านครบแล้ว", tone: "bg-success/15 text-success" },
  withdrawn: { text: "ยกเลิกการส่งตรวจ", tone: "bg-track text-fg-muted" },
};
const VERDICT_CHIP = {
  pass: { text: "✓ ผ่าน", tone: "bg-success/15 text-success" },
  fail: { text: "✕ ไม่ผ่าน", tone: "bg-warning/15 text-warning" },
  pending: { text: "🕒 รอตรวจ", tone: "bg-track text-fg-muted" },
};

const Chip = ({ c, className = "" }) => (
  <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.tone} ${className}`}>{c.text}</span>
);

/**
 * @param {{ panel: object, focus: { key: string, n: number } | null }} props
 *   focus: "Review <Section>" was pressed → scroll to that card and focus its form.
 */
export default function ReviewsTab({ panel, focus }) {
  const review = panel.review;
  useEffect(() => {
    if (!focus) return;
    const card = document.getElementById(`review-card-${focus.key}`);
    card?.scrollIntoView({ block: "center", behavior: "smooth" });
    document.getElementById(`review-feedback-${focus.key}`)?.focus({ preventScroll: true });
  }, [focus]);

  if (!review || (!review.current && review.history.length === 0)) {
    return <p className="rounded-[12px] bg-card-inset py-10 text-center text-sm text-fg-muted">ยังไม่มีการส่งตรวจ</p>;
  }
  const cur = review.current;
  const failed = cur?.sections.filter((s) => s.verdict === "fail").map((s) => s.label) ?? [];
  return (
    <div className="flex flex-col gap-4">
      {cur && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-base font-bold text-fg">
              การตรวจปัจจุบัน
              <Chip c={CYCLE_CHIP[cur.status] ?? CYCLE_CHIP.open} />
            </h4>
            <SubmittedBy cycle={cur} />
          </div>
          <CycleBody panel={panel} cycle={cur} interactive />
          {panel.status === "revising" && cur.status === "revision" && (
            <p className="flex items-start gap-2 rounded-[12px] bg-card-inset px-3 py-2.5 text-xs text-fg-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              แก้ไขเสร็จแล้วกด Resubmit for Review ด้านบน · ระบบส่งตรวจใหม่เฉพาะ {failed.join(", ")} และใช้ลิงก์เดิมเป็นค่าเริ่มต้น
            </p>
          )}
        </>
      )}
      {review.history.length > 0 && (
        <div className="flex flex-col gap-2">
          {review.history.map((c) => (
            <HistoryRow key={c.id} panel={panel} cycle={c} numbered={review.history.length + (cur ? 1 : 0) > 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmittedBy({ cycle }) {
  const p = cycle.submittedBy;
  if (!p) return null;
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
      ส่งโดย
      <Avatar name={p.name} url={p.avatarUrl} size={18} />
      <span className="truncate">
        {p.name}
        {p.roleName ? ` (${p.roleName})` : ""}
      </span>
    </p>
  );
}

/** Link card, note, "ผลตรวจรายส่วน" + section cards. `interactive`: the current cycle (verdict forms). */
function CycleBody({ panel, cycle, interactive = false }) {
  return (
    <>
      <LinkCard cycle={cycle} />
      {cycle.note && cycle.status !== "passed" && (
        <div className="rounded-[12px] bg-card-inset px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            {cycle.resubmit ? "สิ่งที่แก้ไขจาก" : "หมายเหตุจาก"} {cycle.submittedBy?.name ?? ""}
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-sm text-fg">{cycle.note}</p>
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h5 className="text-sm font-bold text-fg">ผลตรวจรายส่วน</h5>
        <p className="text-xs text-fg-muted">Reviewer ตรวจจากลิงก์เดียวกัน</p>
      </div>
      <ul className="flex flex-col gap-3">
        {cycle.sections.map((s) => (
          <li key={s.key}>
            <SectionCard panel={panel} cycle={cycle} s={s} interactive={interactive} />
          </li>
        ))}
      </ul>
    </>
  );
}

function LinkCard({ cycle }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-line px-3.5 py-3">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-info/10 text-info">
        <Link2 className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-bold text-fg">ลิงก์รีวิว</span>{" "}
          <span className="text-xs text-fg-muted">
            {cycle.linkUpdated ? "อัปเดต" : "ส่ง"} {cycle.submittedAtLabel}
          </span>
        </p>
        <a href={cycle.link} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-info underline">
          {cycle.link}
        </a>
      </div>
      <a
        href={cycle.link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the review link in a new tab"
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    </div>
  );
}

function SectionCard({ panel, cycle, s, interactive }) {
  const Icon = SECTION_ICON[s.key] ?? Info;
  const deciding = interactive && !!s.decide;
  const border = deciding ? "border-brand-500" : s.verdict === "fail" ? "border-warning" : "border-line";
  const when =
    s.verdict === "pending" ? (s.assignedAtLabel ? `มอบหมาย ${s.assignedAtLabel}` : "") : s.decidedAtLabel ? `ตรวจเมื่อ ${s.decidedAtLabel}` : "";
  return (
    <section id={interactive ? `review-card-${s.key}` : undefined} aria-label={`${s.label} review`} className={`rounded-[14px] border-2 p-3.5 ${border}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card-inset text-fg-muted">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-fg">
            {s.label}
            {deciding && (
              <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-accent-fg">
                {s.decide === "own" ? "ส่วนของคุณ" : "ตรวจแทน"}
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
            {s.reviewer && <Avatar name={s.reviewer.name} url={s.reviewer.avatarUrl} size={18} />}
            <span>{s.reviewer?.name ?? "ไม่มี Reviewer"}</span>
            {when && <span>· {when}</span>}
            {s.onBehalf && s.decidedByName && <span>(ตรวจแทนโดย {s.decidedByName})</span>}
          </p>
        </div>
        <Chip c={VERDICT_CHIP[s.verdict] ?? VERDICT_CHIP.pending} />
      </div>
      {s.feedback && (
        <div className={`mt-3 rounded-[10px] px-3 py-2.5 ${s.verdict === "fail" ? "bg-warning/10" : "bg-card-inset"}`}>
          <p className={`flex items-center gap-1.5 text-xs font-semibold ${s.verdict === "fail" ? "text-warning" : "text-fg-muted"}`}>
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            Feedback
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-sm text-fg">{s.feedback}</p>
        </div>
      )}
      {deciding && <VerdictForm panel={panel} cycle={cycle} s={s} />}
    </section>
  );
}

function VerdictForm({ panel, cycle, s }) {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const fieldId = `review-feedback-${s.key}`;
  const save = (verdict) => {
    setError("");
    if (verdict === "fail" && !feedback.trim()) {
      setError(FAIL_NEEDS_FEEDBACK);
      document.getElementById(fieldId)?.focus();
      return;
    }
    const fd = new FormData();
    fd.set("projectId", panel.projectId);
    fd.set("contentId", panel.contentId);
    fd.set("taskId", panel.id);
    fd.set("cycleId", cycle.id);
    fd.set("section", s.key);
    fd.set("verdict", verdict);
    fd.set("feedback", feedback);
    startTransition(async () => {
      const res = await recordVerdictAction(fd);
      if (res?.ok) {
        invalidateTaskPanel();
        toast(verdict === "pass" ? `${s.label}: ผ่าน` : `${s.label}: ไม่ผ่าน`);
      } else setError(res?.fieldErrors?.feedback ?? res?.error ?? "Something went wrong.");
    });
  };
  return (
    <div className="mt-3 flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-xs font-semibold text-fg-muted">Feedback · ไม่บังคับ</label>
      <textarea
        id={fieldId}
        rows={3}
        value={feedback}
        onChange={(e) => {
          setFeedback(e.target.value);
          if (error) setError("");
        }}
        placeholder="ความเห็นเพิ่มเติม (ถ้ามี)"
        aria-invalid={!!error || undefined}
        aria-describedby={`${fieldId}-error`}
        className="min-h-20 w-full resize-y rounded-[12px] border border-line bg-card px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      <p id={`${fieldId}-error`} role="alert" className="min-h-4 text-xs text-danger">{error}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">เลือกผลตรวจ · สรุปสถานะ Task เมื่อครบ {cycle.total} ส่วน</p>
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => save("fail")} className={buttonClass("outline", "min-h-9")}>
            ไม่ผ่าน
          </button>
          <button type="button" disabled={pending} onClick={() => save("pass")} className={buttonClass("primary", "min-h-9")}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            ผ่าน
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ panel, cycle, numbered }) {
  return (
    <details className="group rounded-[12px] bg-card-inset">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-fg-muted transition-transform group-open:rotate-90" aria-hidden="true" />
        <span className="text-sm font-bold text-fg">ผลตรวจครั้งก่อน{numbered ? ` · ครั้งที่ ${cycle.cycleNo}` : ""}</span>
        <span className="flex items-center gap-1 text-xs text-fg-muted">
          <Clock3 className="size-3" aria-hidden="true" />
          {cycle.closedAtLabel || cycle.submittedAtLabel}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {cycle.status === "withdrawn" ? (
            <Chip c={CYCLE_CHIP.withdrawn} />
          ) : (
            cycle.sections.map((s) => (
              <span key={s.key} className="flex items-center gap-1 text-xs text-fg-muted">
                {s.label}
                <Chip c={VERDICT_CHIP[s.verdict] ?? VERDICT_CHIP.pending} />
              </span>
            ))
          )}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-line-subtle px-3.5 pb-3.5 pt-3">
        <SubmittedBy cycle={cycle} />
        <CycleBody panel={panel} cycle={cycle} />
      </div>
    </details>
  );
}
