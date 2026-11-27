"use client";

// Round 57.1 — the "page frozen after Edit → Save" fix. Shared by Modal and Drawer
// (both native <dialog> + showModal()).
//
// Cause: with cacheComponents, Next keeps a route it leaves mounted but HIDDEN in
// React <Activity mode="hidden"> (display:none; effects cleaned up). A page segment
// is keyed by its search params, so opening Edit Task (a Link to
// ?task=…&editTask=…) renders a NEW content page and hides the old one — whose
// Task Detail <dialog> was opened with showModal(). Nothing closed it: a modal
// dialog stays in the browser's top layer while hidden, and the topmost modal
// dialog makes EVERYTHING outside it inert. It has no visible backdrop (display:none),
// so after the visible drawers close, the page looks normal but no click lands until
// a reload. Each Edit round-trip can leave another one behind.
//
// Fix: a dialog closes its native modal state when its component is hidden or
// unmounted (layout-effect cleanup, the pattern of Next's "Preserving UI state"
// guide) WITHOUT calling the caller's onClose (the hidden page must not rewrite the
// URL of the visible one); its open effect re-runs showModal() if it is shown again.

import { useLayoutEffect, useRef } from "react";

/**
 * @param {React.RefObject<HTMLDialogElement>} ref
 * @returns {React.RefObject<boolean>} true while a close is silent (skip onClose)
 */
export function useCloseWhenHidden(ref, key = null) {
  const silentRef = useRef(false);
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) {
        silentRef.current = true;
        dialog.close();
      }
    };
    // `key` changes when the component swaps its <dialog> element (Modal's portal).
  }, [ref, key]);
  return silentRef;
}

/**
 * Round 58.1: is this `close` event the dialog's OWN? React 19 propagates the
 * non-bubbling `close` / `cancel` events of a <dialog> through the React tree
 * (only scroll / scrollend stay on the target), so a Modal closed inside a Drawer
 * also ran the Drawer's onClose and closed it (Create Task → Select assets → Done).
 */
export const isOwnDialogEvent = (e) => e.target === e.currentTarget;

// Page scroll lock shared by every open dialog: a COUNT, not "restore what was
// there before" (stacked dialogs released in another order restored a stale value).
let locks = 0;
let saved = "";
/** Lock page scroll; returns an idempotent release. */
export function lockPageScroll() {
  const root = document.documentElement;
  if (locks === 0) {
    saved = root.style.overflow;
    root.style.overflow = "hidden";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) root.style.overflow = saved;
  };
}
