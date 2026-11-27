"use client";

// Current Status box + action card for Production / Graphic / Photo (round 48,
// Figma 355:3579). Everything it shows comes from lib/tasks/statusView.js
// (panel.statusView); the look matches the Clip card (round 45): lock + coloured
// icon tile + Thai status name + muted sub-line | full-width orange button + hint
// (or an outlined Copy button, a hint only, or an info card).
// Buttons: FLOW_ACTIONS moves → task-actions.js runFlowAction (File Location
// ones through a small dialog first); "set_shoot" → the appointment dialog
// (setShootAction, advance at ยังไม่เริ่ม); submit / resubmit → the round-46
// review dialog; review → the Reviews tab; copy → clipboard.

import { useState, useTransition } from "react";
import { CalendarDays, Camera, CircleCheck, Clock, Copy, Eye, FolderOpen, Loader2, Lock, Palette, PauseCircle, TriangleAlert, XCircle } from "lucide-react";
import { runFlowAction, setShootAction } from "@/app/(app)/projects/task-actions";
import { invalidateTaskPanel } from "@/components/tasks/panelCache";
import ReviewDialog from "@/components/tasks/ReviewDialog";
import ShootFields from "@/components/tasks/ShootFields";
import { buttonClass } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
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
  );
}

function ActionCard({ panel, action, onReview }) {
  if (action.kind === "info") {
    return (
      <div className="flex min-w-0 flex-col justify-center gap-1 rounded-[14px] border border-line p-3.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <CircleCheck className="size-4 text-success" aria-hidden="true" />
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
      <p title={isCopy ? action.button.value || undefined : undefined} className="text-xs text-fg-muted">
        {action.hint}
      </p>
      {action.link && <ShootLink panel={panel} label={action.link.label} />}
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
      case "copy":
        try {
          await navigator.clipboard.writeText(button.value);
          toast("คัดลอกแล้ว");
        } catch {
          toast("Couldn't copy — select the path and copy it by hand.", { tone: "error" });
        }
        return;
      case "review":
        onReview?.(button.section);
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

  return (
    <>
      <button type="button" onClick={onClick} disabled={pending || !!button.disabled} className={cls}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : button.actionId === "copy" ? <Copy className="size-4" aria-hidden="true" /> : null}
        {button.label}
      </button>
      {(dialog === "submit" || dialog === "resubmit") && (
        <ReviewDialog task={{ id: panel.id, projectId: panel.projectId, contentId: panel.contentId }} open onClose={close} mode={dialog} />
      )}
      {dialog === "set_shoot" && <ShootDialog panel={panel} open onClose={close} advance />}
      {dialog === "fileLocation" && <FileLocationDialog panel={panel} open onClose={close} onSave={(fl) => run({ fileLocation: fl })} />}
    </>
  );
}

/** Photo ยังไม่เริ่ม without an appointment: "ตั้งวันนัดถ่าย" (no status change). */
function ShootLink({ panel, label: text }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="self-start rounded text-xs font-semibold text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
        {text}
      </button>
      {open && <ShootDialog panel={panel} open onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * "ตั้งวันถ่ายทำ" / "เลื่อนวันนัดถ่าย" (an appointment exists). `advance`: also move
 * Production ยังไม่เริ่ม → นัดถ่ายแล้ว (the primary button). Pre-filled from panel.shoot.
 */
export function ShootDialog({ panel, open, onClose, advance = false }) {
  const s = panel.shoot;
  const title = s && !advance ? "เลื่อนวันนัดถ่าย" : "ตั้งวันถ่ายทำ";
  return (
    <Modal open={open} onClose={onClose} title={title} description={panel.title} size="md">
      <ShootForm panel={panel} advance={advance} onDone={onClose} />
    </Modal>
  );
}

function ShootForm({ panel, advance, onDone }) {
  const s = panel.shoot ?? {};
  const [values, setValues] = useState({ shootDate: s.date ?? "", shootTime: s.time ?? "", shootLocation: s.location ?? "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const save = (e) => {
    e.preventDefault();
    setFormError("");
    const fd = ids(panel);
    for (const [k, val] of Object.entries(values)) fd.set(k, val);
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
      <ShootFields id="shoot-dialog" values={values} setField={(f, val) => setValues((x) => ({ ...x, [f]: val }))} errors={errors} required />
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
