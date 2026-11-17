"use client";

import { createContext, use, useEffect, useRef } from "react";

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
const FIRST_FIELD = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])";

const DrawerClose = createContext(() => {});

/** Inside a <Drawer>: a function that closes it (same path as Escape). */
export const useDrawerClose = () => use(DrawerClose);

export default function Drawer({ open, onClose, labelledBy, returnFocusId, children }) {
  const ref = useRef(null);

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
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    unlockRef.current = () => {
      root.style.overflow = prev;
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
        unlockRef.current?.();
        if (open) onClose?.();
        if (returnFocusId) document.getElementById(returnFocusId)?.focus();
      }}
      // overflow-hidden: the <dialog> itself never scrolls (the UA default is
      // overflow:auto). Only the caller's body region scrolls, so there is exactly
      // one scrollbar and the footer stays pinned at the bottom.
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-l border-line bg-card p-0 text-fg shadow-xl backdrop:bg-black/50 sm:max-w-[520px]"
    >
      {open && (
        <DrawerClose value={requestClose}>
          <div className="flex h-full min-h-0 flex-col">{children}</div>
        </DrawerClose>
      )}
    </dialog>
  );
}
