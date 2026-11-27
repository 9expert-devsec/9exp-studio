"use client";

import { createContext, use, useEffect, useRef } from "react";
import { lockPageScroll, useCloseWhenHidden } from "./dialogLifecycle";

// Right-side drawer on the native <dialog> element, like Modal: showModal() gives
// the focus trap, inert background and Escape for free. ~520px wide, full width on
// small screens, full height, dimmed scrim. The page behind doesn't scroll while
// it is open.
//
// Controlled by `open` (e.g. derived from the URL). Every way of closing (Escape,
// the caller's × / Cancel via `requestClose`, a successful submit) goes through the
// dialog's own close, which calls `onClose` ONCE while `open` is still true; when
// `open` turns false from outside (Back button), it closes without calling it.
// Focus then returns to `returnFocusId` (the trigger).
//
// Children mount only while open (form state resets each time) and close the drawer
// with `useDrawerClose()`.
//
// Round 57.1: when the route is hidden by <Activity> (or the drawer unmounts) the
// native dialog leaves the modal state silently — a hidden modal dialog kept the
// whole page inert (components/ui/dialogLifecycle.js).
const FIRST_FIELD = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])";

const DrawerClose = createContext(() => {});

/** Inside a <Drawer>: a function that closes it (same path as Escape). */
export const useDrawerClose = () => use(DrawerClose);

// Widths: "default" = the task form drawer (520px); "wide" = Task Detail (75% of
// the viewport from xl, full screen below). Static classes (no interpolation).
const SIZE = {
  default: "w-full sm:max-w-[520px]",
  wide: "w-full xl:w-[75vw]",
};

export default function Drawer({ open, onClose, labelledBy, returnFocusId, size = "default", closeOnBackdrop = false, children }) {
  const ref = useRef(null);
  const silentRef = useCloseWhenHidden(ref);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      (dialog.querySelector("[data-autofocus]") ?? dialog.querySelector(FIRST_FIELD))?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Page scroll lock while open. Released on every exit path: `open` turning
  // false, unmount (effect cleanup), and the dialog's own close event (Escape,
  // requestClose) even before the caller flips `open`. Idempotent.
  const unlockRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const release = lockPageScroll();
    unlockRef.current = () => {
      release();
      unlockRef.current = null;
    };
    return () => unlockRef.current?.();
  }, [open]);

  const requestClose = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={() => {
        // A silent close (hidden by Activity / unmounting): not the user's close. Its
        // scroll lock is released by the effect cleanup (this event may arrive after
        // a re-show, e.g. StrictMode's remount, so it must not release the new lock).
        if (silentRef.current) {
          silentRef.current = false;
          return;
        }
        unlockRef.current?.();
        if (open) onClose?.();
        if (returnFocusId) document.getElementById(returnFocusId)?.focus();
      }}
      // The content fills the dialog box, so a click whose target is the <dialog>
      // itself landed on the backdrop.
      onClick={closeOnBackdrop ? (e) => e.target === e.currentTarget && requestClose() : undefined}
      // overflow-hidden: the <dialog> itself never scrolls (the UA default is
      // overflow:auto). Only the caller's body region scrolls, so there is exactly
      // one scrollbar and the footer stays pinned at the bottom.
      className={`fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none max-w-none overflow-hidden border-l border-line bg-card p-0 text-fg shadow-xl backdrop:bg-black/50 ${SIZE[size] ?? SIZE.default}`}
    >
      {open && (
        <DrawerClose value={requestClose}>
          <div className="flex h-full min-h-0 flex-col">{children}</div>
        </DrawerClose>
      )}
    </dialog>
  );
}
