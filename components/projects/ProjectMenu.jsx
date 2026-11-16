"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Ban, Check, ExternalLink, Link2, Loader2, MoreHorizontal, Pencil, Pin, PinOff, RotateCcw } from "lucide-react";
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

/**
 * "⋯" menu for a project (cards, table rows, detail header).
 * Items: Open · Pin/Unpin · Copy link · Edit* · Cancel project* / Reopen*
 * (* owner/admin only, via the server-computed flags; the actions re-check).
 * Sits above a card's full-cover link, so clicks never navigate the card.
 *
 * The open dropdown is PORTALED into document.body (z-50: above page content, below
 * the native <dialog> top layer used by Modal). Rendered inside the row/card, it was
 * trapped in the trigger wrapper's stacking context (`relative z-10`) and later
 * rows' wrappers painted over it. Positioned before paint from the trigger's rect:
 * right edges aligned, opens upward when there isn't room below, clamped 8px inside
 * the viewport. Keyboard: opens focused on the first item; ↑/↓/Home/End move;
 * Escape or Tab closes and returns focus to the trigger.
 */
const VIEWPORT_MARGIN = 8;
const GAP = 8;
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
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  // Position the portaled menu before paint (DOM styles, no state), then focus it.
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
  }, [open]);

  const toggle = () => {
    setError("");
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(project.href, window.location.origin).toString());
      setCopied(true);
    } catch {
      setError("Could not copy the link.");
    }
  };

  return (
    <div ref={rootRef} className={`relative z-10 ${className}`}>
      <IconButton
        ref={buttonRef}
        icon={MoreHorizontal}
        label={`Actions for ${project.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
      />

      {open &&
        createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Actions for ${project.name}`}
          // Hidden until useLayoutEffect has positioned it (still before paint).
          style={{ top: 0, left: 0, visibility: "hidden" }}
          className="fixed z-50 w-56 rounded-[18px] border border-line bg-card p-1.5 shadow-xl"
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
          {showCopy && (
            <button role="menuitem" type="button" className={itemClass} onClick={copyLink}>
              {copied ? (
                <Check className="size-4 text-success" aria-hidden="true" />
              ) : (
                <Link2 className="size-4 text-fg-muted" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          )}
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
          <p role="alert" className={error ? "px-3 py-1.5 text-xs text-danger" : "sr-only"}>
            {error}
          </p>
        </div>,
          document.body
        )}
      <span aria-live="polite" className="sr-only">{copied ? "Link copied" : ""}</span>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this project?"
        description={`“${project.name}” will be marked Cancelled. You can reopen it later.`}
      >
        <CancelConfirm project={project} onDone={() => setConfirmCancel(false)} />
      </Modal>
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
