"use client";

// One copy behaviour for every copy control (round 57.1). On success the control
// swaps to a green check for ~1.5 s ("คัดลอกแล้ว" on labelled buttons), the app
// toast says "คัดลอกแล้ว", and an aria-live="polite" region announces it. A blocked
// clipboard shows "คัดลอกไม่สำเร็จ" the same way (red, error toast).
//   useCopy()          the state machine (idle | copied | failed), timer-safe
//   CopyIconButton     the small icon next to a value (Folder ID, locations …)
//   CopyTextButton     a full button with a label ("คัดลอก File Location")

import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { toast } from "@/components/ui/Toast";

export const COPY_MS = 1500;
export const COPIED_TEXT = "คัดลอกแล้ว";
export const COPY_FAILED_TEXT = "คัดลอกไม่สำเร็จ";

/** @returns {{ state: "idle"|"copied"|"failed", copy: (value: string) => Promise<boolean> }} */
export function useCopy({ withToast = true } = {}) {
  const [state, setState] = useState("idle");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (value) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
      ok = true;
    } catch {
      ok = false;
    }
    setState(ok ? "copied" : "failed");
    if (withToast) toast(ok ? COPIED_TEXT : COPY_FAILED_TEXT, { tone: ok ? "success" : "error" });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), COPY_MS);
    return ok;
  };
  return { state, copy };
}

/** The polite announcement (empty while idle). */
export function CopyLive({ state }) {
  return (
    <span aria-live="polite" className="sr-only">
      {state === "copied" ? COPIED_TEXT : state === "failed" ? COPY_FAILED_TEXT : ""}
    </span>
  );
}

function StateIcon({ state, className }) {
  if (state === "copied") return <Check className={`${className} text-success`} aria-hidden="true" />;
  if (state === "failed") return <X className={`${className} text-danger`} aria-hidden="true" />;
  return <Copy className={className} aria-hidden="true" />;
}

/** Small icon button next to a value. `label`: what is copied ("Folder ID"). */
export function CopyIconButton({ value, label, size = "sm", className = "" }) {
  const { state, copy } = useCopy();
  const box = size === "md" ? "size-8" : "size-7";
  const icon = size === "md" ? "size-4" : "size-3.5";
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label={`คัดลอก ${label}`}
      title={state === "copied" ? COPIED_TEXT : state === "failed" ? COPY_FAILED_TEXT : `คัดลอก ${label}`}
      className={`flex ${box} shrink-0 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500 ${className}`}
    >
      <StateIcon state={state} className={icon} />
      <CopyLive state={state} />
    </button>
  );
}

/** A labelled button: the label becomes "คัดลอกแล้ว" / "คัดลอกไม่สำเร็จ" for ~1.5 s. */
export function CopyTextButton({ value, label, disabled = false, className = "" }) {
  const { state, copy } = useCopy();
  return (
    <button type="button" onClick={() => copy(value)} disabled={disabled} className={className}>
      <StateIcon state={state} className="size-4" />
      {state === "copied" ? COPIED_TEXT : state === "failed" ? COPY_FAILED_TEXT : label}
      <CopyLive state={state} />
    </button>
  );
}
