"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

// Accessible modal on the native <dialog> element: showModal() gives a focus trap,
// inert background, Escape-to-close and focus return for free.
// Children mount only while open, so form state resets each time it opens.
// Clicking the backdrop does NOT close it (protects typed input and one-time passwords).
export default function Modal({ open, onClose, title, description, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-white/10 dark:bg-surface-dark dark:text-white"
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
