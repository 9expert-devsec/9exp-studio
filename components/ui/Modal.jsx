"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { isOwnDialogEvent, useCloseWhenHidden } from "./dialogLifecycle";
import { X } from "lucide-react";

// Accessible modal on the native <dialog> element: showModal() gives a focus trap,
// inert background, Escape-to-close and focus return for free.
// Children mount only while open, so form state resets each time it opens.
// Clicking the backdrop does NOT close it by default (protects typed input and
// one-time passwords). Confirm dialogs with no input pass `closeOnBackdrop`.
//
// Initial focus (showModal() alone would focus the ✕ close button): an element marked
// `data-autofocus` (e.g. the safe action of a confirm dialog), else the first real
// field. React's autoFocus does not work here: it runs before the dialog opens.
// Round 57.1: hidden by <Activity> or unmounted → the native dialog leaves the modal
// state silently (a hidden modal dialog kept the page inert; ./dialogLifecycle.js).
//
// Round 58.1 — a Modal opened from inside a Drawer / another Modal stays LOCAL:
//   - React delivers a <dialog>'s `close` to every onClose up the React tree (it is
//     a non-delegated event that still "bubbles" through components), so each
//     dialog only reacts to its OWN close (isOwnDialogEvent);
//   - it is portalled to <body> once mounted, so it is never inside the parent's
//     <form> in the DOM (no implicit submission of the outer form on Enter);
//   - a submit inside it stops here (never reaches an outer <form onSubmit>).
const FIRST_FIELD =
  "input:not([type=hidden]):not([type=file]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly])";

const WIDTH = { sm: "max-w-lg", md: "max-w-[35rem]" }; // md ≈ 560px (round 46 review dialogs)

const noSubscribe = () => () => {};
/** true on the client after hydration (the server / hydration render keeps the dialog in place, closed). */
const useMounted = () => useSyncExternalStore(noSubscribe, () => true, () => false);

export default function Modal({ open, onClose, title, description, closeOnBackdrop = false, size = "sm", children }) {
  const ref = useRef(null);
  const mounted = useMounted();
  const silentRef = useCloseWhenHidden(ref, mounted);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const target = dialog.querySelector("[data-autofocus]") ?? dialog.querySelector(FIRST_FIELD);
      target?.focus();
    }
    if (!open && dialog.open) dialog.close();
    // `mounted`: the portal swaps the <dialog> element once after hydration.
  }, [open, mounted]);

  const dialog = (
    <dialog
      ref={ref}
      onClose={(e) => {
        if (!isOwnDialogEvent(e)) return; // a nested dialog's close (58.1)
        if (silentRef.current) {
          silentRef.current = false;
          return;
        }
        onClose?.();
      }}
      // The dialog box is fully covered by its padded child, so a click whose target
      // is the <dialog> itself landed on the backdrop.
      onClick={closeOnBackdrop ? (e) => e.target === e.currentTarget && onClose?.() : undefined}
      // A form inside this modal submits only itself (no outer <form onSubmit>).
      onSubmit={(e) => e.stopPropagation()}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${WIDTH[size] ?? WIDTH.sm} overflow-y-auto rounded-[24px] border border-line bg-card p-0 text-fg shadow-xl backdrop:bg-black/50`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
  return mounted ? createPortal(dialog, document.body) : dialog;
}
