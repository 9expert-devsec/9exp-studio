"use client";

// Submit / Resubmit for Review (round 46, Figma 341:3425 / 341:3482). ONE form,
// used by the Task Detail status card, the Graphic status tile and the "Change
// status" form (a move into รอตรวจ swaps to this form). The data comes from
// review-actions.js loadReviewFormAction (mode, last link, sections with their
// reviewer candidates); submitReviewAction re-validates everything.
//   Submit    every section gets a reviewer (pre-filled from the Task; a change is
//             written back to the Task and logged)
//   Resubmit  passed sections are locked rows; only failed ones get a picker;
//             the link is pre-filled with the last one
// No notification wording: none exist (Activity only).

import { useEffect, useState, useTransition } from "react";
import { Info, Link2, Loader2, Lock, Palette, Presentation, Video } from "lucide-react";
import { loadReviewFormAction, submitReviewAction } from "@/app/(app)/projects/review-actions";
import { invalidateTaskPanel } from "@/components/tasks/panelCache";
import PersonPicker from "@/components/tasks/PersonPicker";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { FieldError, input, label } from "@/components/projects/ProjectForm";

export const SECTION_ICON = { present: Presentation, video: Video, design: Palette };

const TEXT = {
  submit: {
    title: "Submit for Review",
    subtitle: "ส่งลิงก์รีวิวให้ Reviewer ตรวจ",
    reviewerHint: "ดึงจากที่มอบหมายไว้ใน Task · ตรวจสอบและเปลี่ยนได้ก่อนส่ง",
    note: "หมายเหตุถึง Reviewer (ไม่บังคับ)",
  },
  resubmit: {
    title: "Resubmit for Review",
    subtitle: "ส่งตรวจใหม่เฉพาะส่วนที่ไม่ผ่าน",
    reviewerHint: "รอบนี้ตรวจเฉพาะส่วนที่ไม่ผ่าน · เปลี่ยนคนตรวจได้",
    note: "สิ่งที่แก้ไข (ไม่บังคับ)",
  },
};

/** The dialog: a Modal around ReviewForm. `mode` is only the title until the data arrives. */
export default function ReviewDialog({ task, open, onClose, mode = "submit" }) {
  const t = TEXT[mode] ?? TEXT.submit;
  return (
    <Modal open={open} onClose={onClose} title={t.title} description={t.subtitle} size="md">
      <ReviewForm task={task} onDone={onClose} />
    </Modal>
  );
}

/**
 * @param {{ task: { id: string, projectId: string, contentId: string }, onDone: () => void, showHeading?: boolean }} props
 *   showHeading: render the title (used inside the Change status modal)
 */
export function ReviewForm({ task, onDone, showHeading = false }) {
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let live = true;
    loadReviewFormAction(task.projectId, task.contentId, task.id)
      .then((res) => {
        if (!live) return;
        if (res?.ok) setForm(res.form);
        else setLoadError(res?.error ?? "Couldn't load the review form.");
      })
      .catch(() => live && setLoadError("Couldn't load the review form."));
    return () => {
      live = false;
    };
  }, [task.projectId, task.contentId, task.id]);

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-danger">{loadError}</p>
        <div className="flex justify-end">
          <button type="button" onClick={onDone} className={buttonClass("secondary")}>Close</button>
        </div>
      </div>
    );
  }
  if (!form) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-fg-muted" aria-busy="true">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading…
      </p>
    );
  }
  return <LoadedForm task={task} form={form} onDone={onDone} showHeading={showHeading} />;
}

function LoadedForm({ task, form, onDone, showHeading }) {
  const t = TEXT[form.mode];
  const [link, setLink] = useState(form.link);
  const [note, setNote] = useState("");
  const [reviewers, setReviewers] = useState(() =>
    Object.fromEntries(form.sections.filter((s) => !s.locked).map((s) => [s.key, s.current ?? ""]))
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const open = form.sections.filter((s) => !s.locked);
  const locked = form.sections.filter((s) => s.locked);

  const submit = (e) => {
    e.preventDefault();
    setFormError("");
    const fd = new FormData();
    fd.set("projectId", task.projectId);
    fd.set("contentId", task.contentId);
    fd.set("taskId", task.id);
    fd.set("link", link);
    fd.set("note", note);
    fd.set("reviewers", JSON.stringify(reviewers));
    startTransition(async () => {
      const res = await submitReviewAction(fd);
      if (res?.ok) {
        invalidateTaskPanel();
        toast(form.mode === "resubmit" ? "ส่งตรวจใหม่แล้ว" : "ส่งตรวจแล้ว");
        onDone();
        return;
      }
      setErrors(res?.fieldErrors ?? {});
      setFormError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {showHeading && (
        <div>
          <p className="text-base font-semibold text-fg">{t.title}</p>
          <p className="text-sm text-fg-muted">{t.subtitle}</p>
        </div>
      )}
      <div>
        <label htmlFor="review-link" className={label}>
          ลิงก์รีวิว <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            id="review-link"
            type="url"
            inputMode="url"
            required
            placeholder="https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className={`${input} pl-9`}
            aria-invalid={!!errors.link || undefined}
            aria-describedby="review-link-error"
          />
        </div>
        <FieldError id="review-link-error" error={errors.link} />
      </div>

      <div className="h-px bg-line-subtle" />

      <div>
        <p className="text-sm font-bold text-fg">Reviewer</p>
        <p className="text-xs text-fg-muted">{t.reviewerHint}</p>
        <div className="mt-3 flex flex-col gap-3">
          {locked.map((s) => (
            <LockedRow key={s.key} s={s} />
          ))}
          {open.map((s) => (
            <SectionPicker
              key={s.key}
              s={s}
              value={reviewers[s.key] ?? ""}
              onChange={(v) => setReviewers((r) => ({ ...r, [s.key]: v }))}
              error={errors[`reviewer_${s.key}`]}
            />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="review-note" className={label}>{t.note}</label>
        <textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${input} resize-y`} aria-describedby="review-note-error" />
        <FieldError id="review-note-error" error={errors.note} />
      </div>

      <p className="flex items-start gap-2 rounded-[12px] bg-card-inset px-3 py-2.5 text-xs text-fg-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {form.mode === "resubmit"
          ? `ตรวจใหม่เฉพาะ ${open.map((s) => s.label).join(", ")}${locked.length ? ` · ผล ${locked.map((s) => s.label).join(", ")} ผ่าน ยังคงอยู่` : ""}`
          : "การเปลี่ยน Reviewer จะอัปเดตใน Task และบันทึกใน Activity"}
      </p>

      {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={buttonClass("outline")}>Cancel</button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {t.title}
        </button>
      </div>
    </form>
  );
}

function SectionName({ s, id }) {
  const Icon = SECTION_ICON[s.key] ?? Info;
  return (
    <span id={id} className="flex w-24 shrink-0 items-center gap-2 text-sm font-semibold text-fg">
      <Icon className="size-4 text-fg-muted" aria-hidden="true" />
      {s.label}
    </span>
  );
}

function SectionPicker({ s, value, onChange, error }) {
  const id = `review-reviewer-${s.key}`;
  const changed = (s.current ?? "") !== value && !!s.current;
  const oldName = s.people.find((p) => p.id === s.current)?.name ?? "";
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <div className="sm:pt-2.5">
        <SectionName s={s} id={`${id}-label`} />
      </div>
      <div className={`min-w-0 flex-1 rounded-[12px] ${changed ? "ring-2 ring-brand-500" : ""}`}>
        <PersonPicker id={id} people={s.people} value={value} onChange={onChange} error={error} emptyText={`ไม่มีสมาชิกที่ตรวจส่วน ${s.label} ได้`} />
        {changed && (
          <span className="mt-1.5 inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
            เปลี่ยนจาก {oldName}
          </span>
        )}
        <FieldError id={`${id}-error`} error={error} />
      </div>
    </div>
  );
}

function LockedRow({ s }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <SectionName s={s} />
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] border border-line bg-card-inset px-3 py-2 text-sm text-fg-muted">
        <Avatar name={s.person.name} url={s.person.avatarUrl} size={24} />
        <span className="min-w-0 truncate">{s.person.name}</span>
        <span className="ml-auto shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">✓ ผ่านแล้ว · ไม่ต้องตรวจใหม่</span>
        <Lock className="size-4 shrink-0" aria-label="ล็อกไว้" />
      </div>
    </div>
  );
}
