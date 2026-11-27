"use client";

// Minimal app-wide toasts. `toast(message, { tone })` from any client component;
// <Toaster /> (mounted once in the (app) layout) shows them bottom-center for ~4s.
// A window event decouples callers from the mount point (no provider needed).
// Announced politely (role="status"); errors assertively (role="alert").
// Round 57.1: the stack is a manual popover, re-shown on every new toast, so it sits
// in the browser's top layer ABOVE an open modal <dialog> (Task Detail, Edit Task).
// As a plain fixed element it was painted under the dialog and its backdrop — e.g.
// the "คัดลอกแล้ว" toast of "คัดลอก File Location" was never visible.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

const EVENT = "studio:toast";
const DURATION_MS = 4000;
let seq = 0;

/** @param {string} message @param {{ tone?: "success" | "error" }} [opts] */
export function toast(message, { tone = "success" } = {}) {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: ++seq, message: String(message), tone } }));
}

export function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const timers = new Set();
    const onToast = (e) => {
      const t = e.detail;
      setItems((cur) => [...cur.slice(-2), t]);
      const timer = setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== t.id));
        timers.delete(timer);
      }, DURATION_MS);
      timers.add(timer);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  const dismiss = (id) => setItems((cur) => cur.filter((x) => x.id !== id));

  // Newest toast → (re)enter the top layer last, i.e. above any modal dialog.
  const ref = useRef(null);
  const lastId = items.at(-1)?.id ?? 0;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.showPopover) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (lastId) el.showPopover();
    } catch {
      /* popover unsupported: stays a plain fixed element */
    }
  }, [lastId]);

  return (
    <div
      ref={ref}
      popover="manual"
      className="pointer-events-none fixed inset-x-0 top-auto bottom-4 z-[60] m-0 flex h-auto w-auto max-w-none flex-col items-center gap-2 overflow-visible border-0 bg-transparent px-4 py-0 [&:not(:popover-open)]:hidden"
    >
      {items.map((t) => {
        const error = t.tone === "error";
        const Icon = error ? CircleAlert : CircleCheck;
        return (
          <div
            key={t.id}
            role={error ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[14px] border border-line bg-card px-4 py-3 text-sm text-fg shadow-xl"
          >
            <Icon className={`size-5 shrink-0 ${error ? "text-danger" : "text-success"}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
