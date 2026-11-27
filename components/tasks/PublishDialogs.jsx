"use client";

// Publish dialogs (round 49, Figma 355:3954 / 355:4538):
//   PublishArticleDialog  ลิงก์บทความ* + วันเวลาที่เผยแพร่* (defaults to now) →
//                         task-actions.js publishArticleAction (→ เผยแพร่แล้ว)
//   PostLinksDialog       one row per platform of the post: URL (+ วันเวลาที่โพสต์,
//                         shown once a URL is filled, defaulting to now) →
//                         savePostLinksAction; partial saves are fine, the status
//                         moves to เผยแพร่แล้ว when every platform has a link.
// Validation is lib/tasks/statusView.js (parseArticlePublish / parsePostLinks),
// re-run on the server.

import { useState, useTransition } from "react";
import { Link2, Loader2 } from "lucide-react";
import { publishArticleAction, savePostLinksAction } from "@/app/(app)/projects/task-actions";
import { invalidateTaskPanel } from "@/components/tasks/panelCache";
import PlatformIcon from "@/components/tasks/PlatformIcon";
import TimeField from "@/components/tasks/TimeField";
import { buttonClass } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { FieldError, input, label } from "@/components/projects/ProjectForm";
import { toBangkokInputs } from "@/lib/projects/rules";

const ids = (panel) => {
  const fd = new FormData();
  fd.set("projectId", panel.projectId);
  fd.set("contentId", panel.contentId);
  fd.set("taskId", panel.id);
  return fd;
};

function Footer({ note, pending, onCancel, label: text }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-fg-muted">{note}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass("outline")}>Cancel</button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {text}
        </button>
      </div>
    </div>
  );
}

function DateTime({ id, date, time, onDate, onTime, error }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <input id={`${id}-date`} type="date" value={date} onChange={(e) => onDate(e.target.value)} className={input} aria-label="วันที่" aria-invalid={!!error || undefined} />
      <TimeField id={`${id}-time`} ariaLabel="เวลา" value={time} onChange={onTime} invalid={!!error} />
    </div>
  );
}

// ── Article ───────────────────────────────────────────────────────────────

export function PublishArticleDialog({ panel, open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="บันทึกการเผยแพร่" description={panel.title} size="md">
      <ArticleForm panel={panel} onDone={onClose} />
    </Modal>
  );
}

function ArticleForm({ panel, onDone }) {
  const [now] = useState(() => toBangkokInputs(new Date()));
  const [url, setUrl] = useState("");
  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const save = (e) => {
    e.preventDefault();
    setFormError("");
    const fd = ids(panel);
    fd.set("url", url);
    fd.set("date", date);
    fd.set("time", time);
    startTransition(async () => {
      const res = await publishArticleAction(fd);
      if (res?.ok) {
        invalidateTaskPanel();
        toast("บันทึกการเผยแพร่แล้ว");
        onDone();
      } else {
        setErrors(res?.fieldErrors ?? {});
        setFormError(res?.fieldErrors ? "" : (res?.error ?? "Something went wrong."));
      }
    });
  };
  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5">
      <div>
        <label htmlFor="publish-url" className={label}>
          ลิงก์บทความ <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            id="publish-url"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`${input} pl-9`}
            aria-invalid={!!errors.url || undefined}
            aria-describedby="publish-url-error"
          />
        </div>
        <FieldError id="publish-url-error" error={errors.url} />
      </div>
      <div>
        <p className={label}>
          วันเวลาที่เผยแพร่ <span className="text-danger" aria-hidden="true">*</span>
        </p>
        <DateTime id="publish-at" date={date} time={time} onDate={setDate} onTime={setTime} error={errors.publishedAt} />
        <FieldError id="publish-at-error" error={errors.publishedAt} />
      </div>
      {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
      <Footer note="เปลี่ยนสถานะเป็นเผยแพร่แล้ว" pending={pending} onCancel={onDone} label="บันทึกการเผยแพร่" />
    </form>
  );
}

// ── Post ──────────────────────────────────────────────────────────────────

export function PostLinksDialog({ panel, open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="บันทึกการโพสต์" description={panel.title} size="md">
      <PostForm panel={panel} onDone={onClose} />
    </Modal>
  );
}

function PostForm({ panel, onDone }) {
  const platforms = panel.statusView?.postLinks ?? [];
  const [rows, setRows] = useState(() =>
    platforms.map((p) => {
      const at = toBangkokInputs(p.link?.postedAt ?? null);
      return { id: p.id, label: p.label, icon: p.icon, url: p.link?.url ?? "", date: at.date, time: at.time };
    })
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const setRow = (id, patch) =>
    setRows((list) =>
      list.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // postedAt defaults to now when the URL is first filled.
        if (patch.url && !r.date && !r.time) Object.assign(next, toBangkokInputs(new Date()));
        return next;
      })
    );
  const save = (e) => {
    e.preventDefault();
    setFormError("");
    const fd = ids(panel);
    fd.set("links", JSON.stringify(rows.map((r) => ({ platformId: r.id, url: r.url, date: r.date, time: r.time }))));
    startTransition(async () => {
      const res = await savePostLinksAction(fd);
      if (res?.ok) {
        invalidateTaskPanel();
        toast(res.published ? "เผยแพร่แล้ว" : "บันทึกลิงก์แล้ว");
        onDone();
      } else {
        setErrors(res?.fieldErrors ?? {});
        setFormError(res?.fieldErrors ? "" : (res?.error ?? "Something went wrong."));
      }
    });
  };
  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4">
      {rows.length === 0 && <p className="text-sm text-fg-muted">Post นี้ยังไม่มี Platform — แก้ไข Task เพื่อเลือก Platform ก่อน</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-[12px] border border-line p-3">
          <label htmlFor={`post-url-${r.id}`} className="flex items-center gap-2 text-sm font-semibold text-fg">
            <PlatformIcon icon={r.icon} />
            {r.label}
          </label>
          <input
            id={`post-url-${r.id}`}
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={r.url}
            onChange={(e) => setRow(r.id, { url: e.target.value })}
            className={input}
            aria-invalid={!!errors[r.id] || undefined}
            aria-describedby={`post-url-${r.id}-error`}
          />
          {r.url.trim() && (
            <div>
              <p className="mb-1 text-xs text-fg-muted">วันเวลาที่โพสต์</p>
              <DateTime id={`post-at-${r.id}`} date={r.date} time={r.time} onDate={(v) => setRow(r.id, { date: v })} onTime={(v) => setRow(r.id, { time: v })} error={errors[r.id]} />
            </div>
          )}
          <FieldError id={`post-url-${r.id}-error`} error={errors[r.id]} />
        </div>
      ))}
      {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
      <Footer note="บันทึกได้ทีละ Platform · เปลี่ยนเป็นเผยแพร่แล้วเมื่อครบทุก Platform" pending={pending} onCancel={onDone} label="บันทึก" />
    </form>
  );
}
