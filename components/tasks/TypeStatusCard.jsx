"use client";

// Current Status box + action card for Production / Graphic / Photo (round 48)
// and Article / Post (round 49: amber "asset not ready" banner above it, the
// publish dialogs, open links) — Figma 355:3579. Everything it shows comes from lib/tasks/statusView.js
// (panel.statusView); the look matches the Clip card (round 45): lock + coloured
// icon tile + Thai status name + muted sub-line | full-width orange button + hint
// (or an outlined Copy button, a hint only, or an info card).
// Buttons: FLOW_ACTIONS moves → task-actions.js runFlowAction (File Location
// ones through a small dialog first); "set_shoot" → the appointment dialog
// (setShootAction, advance at ยังไม่เริ่ม); submit / resubmit → the round-46
// review dialog; review → the Reviews tab; copy → clipboard.

import { useState, useTransition } from "react";
import {
  CalendarDays,
  Camera,
  CircleCheck,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FolderOpen,
  Globe,
  Loader2,
  Lock,
  Package,
  Palette,
  PauseCircle,
  Pencil,
  RefreshCw,
  Send,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { runFlowAction, setShootAction } from "@/app/(app)/projects/task-actions";
import { invalidateTaskPanel } from "@/components/tasks/panelCache";
import ReviewDialog from "@/components/tasks/ReviewDialog";
import PlatformIcon from "@/components/tasks/PlatformIcon";
import { PostLinksDialog, PublishArticleDialog } from "@/components/tasks/PublishDialogs";
import ShootSessionsFields, { newSessionRow, sessionRowsPayload } from "@/components/tasks/ShootFields";
import { buttonClass } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { CopyTextButton } from "@/components/ui/CopyButton";
import { FieldError, input, label } from "@/components/projects/ProjectForm";

const ICON = {
  clock: { Icon: Clock, tone: "bg-accent-soft text-accent-fg" },
  calendar: { Icon: CalendarDays, tone: "bg-accent-soft text-accent-fg" },
  camera: { Icon: Camera, tone: "bg-accent-soft text-accent-fg" },
  palette: { Icon: Palette, tone: "bg-accent-soft text-accent-fg" },
  folder: { Icon: FolderOpen, tone: "bg-accent-soft text-accent-fg" },
  eye: { Icon: Eye, tone: "bg-brand-500/15 text-accent-fg" },
  warning: { Icon: TriangleAlert, tone: "bg-warning/15 text-warning" },
  check: { Icon: CircleCheck, tone: "bg-success/15 text-success" },
  pause: { Icon: PauseCircle, tone: "bg-warning/15 text-warning" },
  x: { Icon: XCircle, tone: "bg-danger/10 text-danger" },
  pencil: { Icon: Pencil, tone: "bg-accent-soft text-accent-fg" },
  box: { Icon: Package, tone: "bg-accent-soft text-accent-fg" },
  send: { Icon: Send, tone: "bg-accent-soft text-accent-fg" },
  globe: { Icon: Globe, tone: "bg-success/15 text-success" },
};

const ids = (panel) => {
  const fd = new FormData();
  fd.set("projectId", panel.projectId);
  fd.set("contentId", panel.contentId);
  fd.set("taskId", panel.id);
  return fd;
};

/**
 * @param {{ panel: object, onReview: (sectionKey: string) => void }} props
 */
export default function TypeStatusCard({ panel, onReview }) {
  const v = panel.statusView;
  const { Icon, tone } = ICON[v.box.icon] ?? ICON.clock;
  const action = v.action;
  return (
    <>
    {v.banner && (
      // Round 49: รอเผยแพร่ with a not-ready asset — the status never steps back on its own.
      <div role="status" className="mt-4 flex gap-2.5 rounded-[12px] border border-warning/40 bg-warning/10 px-3.5 py-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-warning">{v.banner.title}</p>
          <p className="break-words text-xs text-fg">{v.banner.line}</p>
        </div>
      </div>
    )}
    <div className={`mt-4 grid gap-3 ${action ? "sm:grid-cols-2" : ""}`}>
      <div className="flex gap-3 rounded-[14px] bg-card-inset p-3.5">
        <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-fg-muted">
            Current Status
            <Lock className="size-3" aria-hidden="true" />
            <span className="sr-only">(changes through the actions)</span>
          </p>
          <p className="mt-0.5 text-lg font-bold leading-snug text-fg">{v.box.title}</p>
          <p title={v.box.subTitle} className={`mt-0.5 text-xs text-fg-muted ${v.box.truncate ? "truncate" : "break-words"}`}>
            {v.box.sub}
          </p>
        </div>
      </div>
      {action && <ActionCard panel={panel} action={action} onReview={onReview} />}
    </div>
    </>
  );
}

function ActionCard({ panel, action, onReview }) {
  if (action.kind === "info") {
    return (
      <div className="flex min-w-0 flex-col justify-center gap-1 rounded-[14px] border border-line p-3.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          {action.info.icon === "auto" ? (
            <RefreshCw className="size-4 text-accent-fg" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
          )}
          {action.info.title}
        </p>
        <p className="text-xs text-fg-muted">{action.info.line}</p>
      </div>
    );
  }
  const isCopy = action.button?.actionId === "copy";
  return (
    <div className="flex min-w-0 flex-col justify-center gap-2 rounded-[14px] border border-line p-3.5">
      {action.button && <ActionButton panel={panel} button={action.button} outline={action.kind === "outline"} onReview={onReview} />}
      <p title={isCopy || action.truncateHint ? action.button?.value || action.hint : undefined} className={`text-xs text-fg-muted ${action.truncateHint ? "truncate" : ""}`}>
        {action.hint}
      </p>
    </div>
  );
}

function ActionButton({ panel, button, outline, onReview }) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState(null);
  const cls = buttonClass(outline ? "outline" : "primary", "w-full");
  const close = () => setDialog(null);

  const run = (extra = {}) =>
    new Promise((resolve) =>
      startTransition(async () => {
        const fd = ids(panel);
        fd.set("actionId", button.actionId);
        for (const [k, val] of Object.entries(extra)) fd.set(k, val);
        const res = await runFlowAction(fd);
        if (res?.ok) {
          invalidateTaskPanel();
          toast("Status updated");
        } else if (!res?.fieldErrors) toast(res?.error ?? "Something went wrong.", { tone: "error" });
        resolve(res);
      })
    );

  const onClick = async () => {
    switch (button.actionId) {
      case "review":
        onReview?.(button.section);
        return;
      case "open_url":
        if (button.value) window.open(button.value, "_blank", "noopener,noreferrer");
        return;
      case "publish":
      case "post_links":
        setDialog(button.actionId);
        return;
      case "submit":
      case "resubmit":
      case "set_shoot":
        setDialog(button.actionId);
        return;
      default:
        if (["card", "filed"].includes(button.actionId)) setDialog("fileLocation");
        else run();
    }
  };

  // Round 57.1: "คัดลอก File Location" — the shared copy feedback (check + "คัดลอกแล้ว").
  if (button.actionId === "copy") return <CopyTextButton value={button.value} label={button.label} disabled={!!button.disabled} className={cls} />;
  // "เปิดโพสต์": one platform opens directly, several open a small menu.
  if (button.actionId === "open_posts" && (button.links?.length ?? 0) > 1) return <OpenPostsMenu button={button} className={cls} />;
  const icon =
    button.actionId === "copy" ? <Copy className="size-4" aria-hidden="true" /> : button.actionId.startsWith("open_") ? <ExternalLink className="size-4" aria-hidden="true" /> : null;
  return (
    <>
      <button
        type="button"
        onClick={button.actionId === "open_posts" ? () => button.links?.[0] && window.open(button.links[0].url, "_blank", "noopener,noreferrer") : onClick}
        disabled={pending || !!button.disabled}
        className={cls}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
        {button.label}
      </button>
      {dialog === "publish" && <PublishArticleDialog panel={panel} open onClose={close} />}
      {dialog === "post_links" && <PostLinksDialog panel={panel} open onClose={close} />}
      {(dialog === "submit" || dialog === "resubmit") && (
        <ReviewDialog task={{ id: panel.id, projectId: panel.projectId, contentId: panel.contentId }} open onClose={close} mode={dialog} />
      )}
      {dialog === "set_shoot" && <ShootDialog panel={panel} open onClose={close} advance />}
      {dialog === "fileLocation" && <FileLocationDialog panel={panel} open onClose={close} onSave={(fl) => run({ fileLocation: fl })} />}
    </>
  );
}

function OpenPostsMenu({ button, className }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-haspopup="menu" className={className}>
        <ExternalLink className="size-4" aria-hidden="true" />
        {button.label}
      </button>
      {open && (
        <ul role="menu" className="absolute left-0 right-0 z-20 mt-1 rounded-[12px] border border-line bg-card p-1 shadow-xl">
          {button.links.map((l) => (
            <li key={l.id} role="none">
              <a
                role="menuitem"
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-sm text-fg hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <PlatformIcon icon={l.icon} size={16} />
                {l.label}
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Production "ตั้งวันถ่ายทำ" / "แก้ไขนัดถ่าย" (round 57.1): the WHOLE session list
 * (at least one). `advance`: the primary button at ยังไม่เริ่ม (→ นัดถ่ายแล้ว; the
 * first session also moves it automatically). Pre-filled from panel.shootSessions.
 */
export function ShootDialog({ panel, open, onClose, advance = false }) {
  const has = (panel.shootSessions ?? []).length > 0;
  const title = has && !advance ? "แก้ไขนัดถ่าย" : "ตั้งวันถ่ายทำ";
  return (
    <Modal open={open} onClose={onClose} title={title} description={panel.title} size="md">
      <ShootForm panel={panel} advance={advance} onDone={onClose} />
    </Modal>
  );
}

function ShootForm({ panel, advance, onDone }) {
  const [rows, setRows] = useState(() => {
    const saved = (panel.shootSessions ?? []).map((x) => ({ key: x._id, _id: x._id, date: x.date, startTime: x.startTime, endTime: x.endTime ?? "", location: x.location ?? "" }));
    return saved.length ? saved : [newSessionRow()];
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const save = (e) => {
    e.preventDefault();
    setFormError("");
    const fd = ids(panel);
    fd.set("shootSessions", JSON.stringify(sessionRowsPayload(rows)));
    if (advance) fd.set("advance", "1");
    startTransition(async () => {
      const res = await setShootAction(fd);
      if (res?.ok) {
        invalidateTaskPanel();
        toast("บันทึกนัดถ่ายแล้ว");
        onDone();
      } else {
        setErrors(res?.fieldErrors ?? {});
        setFormError(res?.error ?? "Something went wrong.");
      }
    });
  };
  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5">
      <ShootSessionsFields id="shoot-dialog" rows={rows} onChange={setRows} errors={errors} />
      {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={buttonClass("outline")}>Cancel</button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          บันทึกนัดถ่าย
        </button>
      </div>
    </form>
  );
}

/** File Location* before "ลงการ์ดแล้ว" / "ยืนยันไฟล์เข้าโฟลเดอร์" (pre-filled from the task). */
function FileLocationDialog({ panel, open, onClose, onSave }) {
  return (
    <Modal open={open} onClose={onClose} title="File Location" description={panel.title} size="md">
      <FileLocationForm initial={panel.statusView?.fileLocation ?? ""} onSave={onSave} onDone={onClose} />
    </Modal>
  );
}

function FileLocationForm({ initial, onSave, onDone }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!value.trim()) return setError("ระบุ File Location");
    setPending(true);
    const res = await onSave(value.trim());
    setPending(false);
    if (res?.ok) onDone();
    else setError(res?.fieldErrors?.fileLocation ?? res?.error ?? "Something went wrong.");
  };
  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5">
      <div>
        <label htmlFor="flow-file-location" className={label}>
          File Location <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <textarea
          id="flow-file-location"
          rows={2}
          maxLength={1000}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError("");
          }}
          placeholder="Path หรือลิงก์ของโฟลเดอร์"
          className={`${input} resize-y font-mono text-sm`}
          aria-invalid={!!error || undefined}
          aria-describedby="flow-file-location-error"
        />
        <FieldError id="flow-file-location-error" error={error} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={buttonClass("outline")}>Cancel</button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          บันทึก
        </button>
      </div>
    </form>
  );
}
