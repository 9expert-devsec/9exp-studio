"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRightLeft,
  Ban,
  Check,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { deleteContentAction } from "@/app/(app)/projects/content-actions";
import { changeTaskStatusAction, deleteTaskAction } from "@/app/(app)/projects/task-actions";
import { assetStatuses, taskStatuses } from "@/lib/tasks/types";
import { StatusDot } from "./ProjectBits";
import { buttonClass } from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";
import {
  cancelProjectAction,
  reopenProjectAction,
  togglePinAction,
} from "@/app/(app)/projects/actions";

const itemClass =
  "flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm text-fg hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60";

const VIEWPORT_MARGIN = 8;
const GAP = 8;

/**
 * The "⋯" dropdown shell shared by ProjectMenu and ContentMenu (controlled: the
 * caller owns `open`). Sits above a card's full-cover link, so clicks never
 * navigate the card.
 *
 * The open dropdown is PORTALED into document.body (z-50: above page content, below
 * the native <dialog> top layer used by Modal). Rendered inside the row/card, it was
 * trapped in the trigger wrapper's stacking context (`relative z-10`) and later
 * rows' wrappers painted over it. Positioned before paint from the trigger's rect:
 * right edges aligned, opens upward when there isn't room below, clamped 8px inside
 * the viewport. Closes on outside click, scroll and resize. Keyboard: opens focused
 * on the first item; ↑/↓/Home/End move; Escape or Tab closes and returns focus to
 * the trigger.
 *
 * `aside` renders inside the trigger wrapper (live regions, a Modal), so it keeps
 * the wrapper's pointer-events inside cards.
 */
function ActionMenu({ label, open, setOpen, onToggle, className = "", children, aside }) {
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  // Position the portaled menu before paint (DOM styles, no state).
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const trigger = buttonRef.current;
    if (!menu || !trigger) return;
    const r = trigger.getBoundingClientRect();
    const { width: w, height: h } = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

    const left = clamp(r.right - w, VIEWPORT_MARGIN, vw - w - VIEWPORT_MARGIN);
    const fitsBelow = r.bottom + GAP + h <= vh - VIEWPORT_MARGIN;
    const top = clamp(fitsBelow ? r.bottom + GAP : r.top - GAP - h, VIEWPORT_MARGIN, vh - h - VIEWPORT_MARGIN);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = "visible";
  }, [open]);

  // Focus the first item when the menu opens (open state only, not on re-renders).
  useEffect(() => {
    if (open) menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const inside = (t) => rootRef.current?.contains(t) || menuRef.current?.contains(t);
    const onPointer = (e) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape" || (e.key === "Tab" && menuRef.current?.contains(document.activeElement))) {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      const menu = menuRef.current;
      if (!menu || !menu.contains(document.activeElement)) return;
      const items = [...menu.querySelectorAll('[role="menuitem"]:not([disabled])')];
      if (!items.length) return;
      const i = items.indexOf(document.activeElement);
      const next =
        e.key === "ArrowDown" ? items[(i + 1) % items.length]
        : e.key === "ArrowUp" ? items[(i - 1 + items.length) % items.length]
        : e.key === "Home" ? items[0]
        : e.key === "End" ? items[items.length - 1]
        : null;
      if (next) {
        e.preventDefault();
        next.focus();
      }
    };
    const onMove = () => setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, setOpen]);

  return (
    <div ref={rootRef} className={`relative z-10 ${className}`}>
      <IconButton
        ref={buttonRef}
        icon={MoreHorizontal}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle?.();
          setOpen((v) => !v);
        }}
      />

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            // Hidden until useLayoutEffect has positioned it (still before paint).
            style={{ top: 0, left: 0, visibility: "hidden" }}
            className="fixed z-50 w-56 rounded-[18px] border border-line bg-card p-1.5 shadow-xl"
          >
            {children}
          </div>,
          document.body
        )}
      {aside}
    </div>
  );
}

/** Clipboard copy with a 1.5s "Copied" flag. */
function useCopyLink(onError) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
      setCopied(true);
    } catch {
      onError("Could not copy the link.");
    }
  };
  return [copied, copy];
}

function CopyItem({ copied, onClick, label }) {
  return (
    <button role="menuitem" type="button" className={itemClass} onClick={onClick}>
      {copied ? (
        <Check className="size-4 text-success" aria-hidden="true" />
      ) : (
        <Link2 className="size-4 text-fg-muted" aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

function MenuError({ error }) {
  return (
    <p role="alert" className={error ? "px-3 py-1.5 text-xs text-danger" : "sr-only"}>
      {error}
    </p>
  );
}

/**
 * "⋯" menu for a project (cards, table rows, detail header).
 * Items: Open · Pin/Unpin · Copy link · Edit* · Cancel project* / Reopen*
 * (* owner/admin only, via the server-computed flags; the actions re-check).
 */
export default function ProjectMenu({
  project,
  showOpen = true,
  showPin = true,
  showCopy = true,
  showEdit = true,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [copied, copy] = useCopyLink(setError);

  const run = (action, { close = true } = {}) => {
    setError("");
    const fd = new FormData();
    fd.set("id", project.id);
    startTransition(async () => {
      const res = await action(fd);
      if (res?.ok) {
        if (close) setOpen(false);
      } else {
        setError(res?.error ?? "Something went wrong.");
        setOpen(true);
      }
    });
  };

  return (
    <ActionMenu
      label={`Actions for ${project.name}`}
      open={open}
      setOpen={setOpen}
      onToggle={() => setError("")}
      className={className}
      aside={
        <>
          <span aria-live="polite" className="sr-only">{copied ? "Link copied" : ""}</span>
          <Modal
            open={confirmCancel}
            onClose={() => setConfirmCancel(false)}
            title="Cancel this project?"
            description={`“${project.name}” will be marked Cancelled. You can reopen it later.`}
          >
            <CancelConfirm project={project} onDone={() => setConfirmCancel(false)} />
          </Modal>
        </>
      }
    >
      {showOpen && (
        <Link role="menuitem" href={project.href} className={itemClass} onClick={() => setOpen(false)}>
          <ExternalLink className="size-4 text-fg-muted" aria-hidden="true" />
          Open
        </Link>
      )}
      {showPin && (
        <button role="menuitem" type="button" className={itemClass} disabled={pending} onClick={() => run(togglePinAction)}>
          {project.pinned ? (
            <PinOff className="size-4 text-fg-muted" aria-hidden="true" />
          ) : (
            <Pin className="size-4 text-fg-muted" aria-hidden="true" />
          )}
          {project.pinned ? "Unpin" : "Pin"}
        </button>
      )}
      {showCopy && <CopyItem copied={copied} onClick={() => copy(project.href)} label="Copy link" />}
      {showEdit && project.canEdit && (
        <Link role="menuitem" href={`${project.href}/edit`} className={itemClass} onClick={() => setOpen(false)}>
          <Pencil className="size-4 text-fg-muted" aria-hidden="true" />
          Edit
        </Link>
      )}
      {project.canCancel && (
        <button
          role="menuitem"
          type="button"
          className={`${itemClass} text-danger`}
          onClick={() => {
            setOpen(false);
            setConfirmCancel(true);
          }}
        >
          <Ban className="size-4" aria-hidden="true" />
          Cancel project
        </button>
      )}
      {project.canReopen && (
        <button role="menuitem" type="button" className={itemClass} disabled={pending} onClick={() => run(reopenProjectAction)}>
          <RotateCcw className="size-4 text-fg-muted" aria-hidden="true" />
          Reopen
        </button>
      )}
      {pending && (
        <p className="flex items-center gap-2 px-3 py-1.5 text-xs text-fg-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Working…
        </p>
      )}
      <MenuError error={error} />
    </ActionMenu>
  );
}

/**
 * "⋯" menu for a content item: Open · Open brief · Copy brief link (with a brief) ·
 * Edit (content.canEdit) · divider · Delete content (content.canDelete). The server
 * actions re-check every flag. Delete only ever runs from the confirm dialog.
 * `then`: "list" refreshes in place after a delete; "project" redirects to the
 * Content tab. Renders nothing when no item applies.
 */
export function ContentMenu({ content, showOpen = true, showEdit = true, then = "list" }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [copied, copy] = useCopyLink(setError);
  const canEdit = showEdit && content.canEdit;
  if (!showOpen && !content.briefLink && !canEdit && !content.canDelete) return null;

  return (
    <ActionMenu
      label={`Actions for ${content.name}`}
      open={open}
      setOpen={setOpen}
      onToggle={() => setError("")}
      aside={
        <>
          <span aria-live="polite" className="sr-only">{copied ? "Brief link copied" : ""}</span>
          {content.canDelete && (
            <DeleteContentDialog
              open={confirmDelete}
              onClose={() => setConfirmDelete(false)}
              content={content}
              then={then}
            />
          )}
        </>
      }
    >
      {showOpen && (
        <Link role="menuitem" href={content.href} className={itemClass} onClick={() => setOpen(false)}>
          <ExternalLink className="size-4 text-fg-muted" aria-hidden="true" />
          Open
        </Link>
      )}
      {content.briefLink && (
        <>
          <a
            role="menuitem"
            href={content.briefLink}
            target="_blank"
            rel="noopener noreferrer"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <FileText className="size-4 text-fg-muted" aria-hidden="true" />
            Open brief
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <CopyItem copied={copied} onClick={() => copy(content.briefLink)} label="Copy brief link" />
        </>
      )}
      {canEdit && (
        <Link role="menuitem" href={content.editHref} className={itemClass} onClick={() => setOpen(false)}>
          <Pencil className="size-4 text-fg-muted" aria-hidden="true" />
          Edit
        </Link>
      )}
      {content.canDelete && (
        <>
          <div role="separator" className="my-1 h-px bg-line-subtle" />
          <button
            role="menuitem"
            type="button"
            className={`${itemClass} text-danger`}
            onClick={() => {
              setOpen(false);
              setConfirmDelete(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete content
          </button>
        </>
      )}
      <MenuError error={error} />
    </ActionMenu>
  );
}

/**
 * THE confirm for deleting a content item (⋯ menus and the Edit Content page): the
 * only UI path to deleteContentAction. Cancel has initial focus; Escape and the
 * backdrop cancel.
 * @param {{ open: boolean, onClose: () => void, then: "list" | "project",
 *           content: { id: string, projectId: string, name: string } }} props
 */
export function DeleteContentDialog({ open, onClose, content, then = "list" }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop
      title="Delete content?"
      description={`“${content.name}” will be permanently deleted. This can't be undone.`}
    >
      <DeleteContentConfirm content={content} then={then} onDone={onClose} />
    </Modal>
  );
}

function DeleteContentConfirm({ content, then, onDone }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError("");
    const fd = new FormData();
    fd.set("projectId", content.projectId);
    fd.set("contentId", content.id);
    fd.set("then", then);
    startTransition(async () => {
      // then="project": the action redirects (no result). then="list": { ok } + refresh.
      const res = await deleteContentAction(fd);
      if (res?.ok) onDone();
      else if (res) setError(res.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={buttonClass("secondary")} data-autofocus>
          Cancel
        </button>
        <button type="button" onClick={confirm} disabled={pending} className={buttonClass("danger")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Delete
        </button>
      </div>
    </div>
  );
}

/**
 * "⋯" menu for a task (Cards footer and Table rows): Edit task (task.canEdit, opens
 * the drawer via task.editHref) · Change status (task.canChangeStatus) · Delete
 * task (task.canDelete). Both are re-checked by the
 * server actions, which also recompute the content/project roll-ups and refresh in
 * place. Renders nothing when neither applies.
 */
export function TaskMenu({ task }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const canEdit = !!(task.canEdit && task.editHref);
  if (!canEdit && !task.canChangeStatus && !task.canDelete) return null;
  const close = () => setDialog(null);
  const idLabel = `TASK ${task.numberLabel}`;

  return (
    <ActionMenu
      label={`Actions for ${idLabel}`}
      open={open}
      setOpen={setOpen}
      aside={
        <>
          {task.canChangeStatus && (
            <Modal open={dialog === "status"} onClose={close} title="Change status" description={`${idLabel} · ${task.title}`}>
              <ChangeTaskStatusForm task={task} onDone={close} />
            </Modal>
          )}
          {task.canDelete && (
            <Modal
              open={dialog === "delete"}
              onClose={close}
              closeOnBackdrop
              title="Delete task?"
              description={`“${task.title}” will be permanently deleted. This can't be undone.`}
            >
              <DeleteTaskConfirm task={task} onDone={close} />
            </Modal>
          )}
        </>
      }
    >
      {canEdit && (
        <Link role="menuitem" href={task.editHref} scroll={false} className={itemClass} onClick={() => setOpen(false)}>
          <Pencil className="size-4 text-fg-muted" aria-hidden="true" />
          Edit task
        </Link>
      )}
      {task.canChangeStatus && (
        <button
          role="menuitem"
          type="button"
          className={itemClass}
          onClick={() => {
            setOpen(false);
            setDialog("status");
          }}
        >
          <ArrowRightLeft className="size-4 text-fg-muted" aria-hidden="true" />
          Change status
        </button>
      )}
      {task.canDelete && (
        <>
          {(canEdit || task.canChangeStatus) && <div role="separator" className="my-1 h-px bg-line-subtle" />}
          <button
            role="menuitem"
            type="button"
            className={`${itemClass} text-danger`}
            onClick={() => {
              setOpen(false);
              setDialog("delete");
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete task
          </button>
        </>
      )}
    </ActionMenu>
  );
}

const optionRow =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border border-line px-3.5 text-sm text-fg transition-colors hover:bg-card-inset has-[:checked]:border-brand-500 has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500";

/** One radio list (Thai labels from the catalog), the current value checked. */
function StatusRadios({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-fg">{legend}</legend>
      {options.map((o) => (
        <label key={o.key} className={optionRow}>
          <input
            type="radio"
            name={name}
            value={o.key}
            checked={value === o.key}
            onChange={() => onChange(o.key)}
            data-autofocus={value === o.key ? true : undefined}
            className="size-4 accent-brand-500"
          />
          <span className="flex-1">{o.label}</span>
          {o.group && <StatusDot status={o.group} />}
        </label>
      ))}
    </fieldset>
  );
}

function ChangeTaskStatusForm({ task, onDone }) {
  const statuses = taskStatuses(task.type);
  const assets = assetStatuses(task.type);
  const [status, setStatus] = useState(task.status);
  const [asset, setAsset] = useState(task.assetStatus ?? assets[0]?.key ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("projectId", task.projectId);
    fd.set("contentId", task.contentId);
    fd.set("taskId", task.id);
    fd.set("status", status);
    if (assets.length) fd.set("assetStatus", asset);
    startTransition(async () => {
      const res = await changeTaskStatusAction(fd);
      if (res?.ok) onDone();
      else setError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <StatusRadios legend="Status" name="status" options={statuses} value={status} onChange={setStatus} />
      {assets.length > 0 && (
        <StatusRadios legend="Status Asset" name="assetStatus" options={assets} value={asset} onChange={setAsset} />
      )}
      <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={buttonClass("secondary")}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
      </div>
    </form>
  );
}

function DeleteTaskConfirm({ task, onDone }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError("");
    const fd = new FormData();
    fd.set("projectId", task.projectId);
    fd.set("contentId", task.contentId);
    fd.set("taskId", task.id);
    startTransition(async () => {
      const res = await deleteTaskAction(fd);
      if (res?.ok) onDone();
      else setError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={buttonClass("secondary")} data-autofocus>
          Cancel
        </button>
        <button type="button" onClick={confirm} disabled={pending} className={buttonClass("danger")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Delete
        </button>
      </div>
    </div>
  );
}

function CancelConfirm({ project, onDone }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError("");
    const fd = new FormData();
    fd.set("id", project.id);
    startTransition(async () => {
      const res = await cancelProjectAction(fd);
      if (res?.ok) onDone();
      else setError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={buttonClass("secondary")} data-autofocus>
          Keep project
        </button>
        <button type="button" onClick={confirm} disabled={pending} className={buttonClass("danger")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Cancel project
        </button>
      </div>
    </div>
  );
}
