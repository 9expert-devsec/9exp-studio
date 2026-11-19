"use client";

// A link that opens the Task Detail panel (?task=<id>) WITHOUT a page round-trip:
// a plain click pushes the URL with the native History API (Next.js integrates it,
// so useSearchParams updates at once and the server page is not re-rendered).
// Ctrl/⌘/Shift/middle click keep the real href (new tab / window → the page opens
// the panel from the URL). Inside a SortableBoard the click that ends a drag is
// swallowed in the capture phase before it gets here (round 30).

import { taskPanelUrl } from "@/lib/tasks/panelUrl";

/**
 * Open (push) or swap (replace) the panel to `taskId`, keeping every other param.
 * @param {string} taskId @param {{ replace?: boolean }} [opts]
 */
export function openTaskPanel(taskId, { replace = false } = {}) {
  // A click can leave a text selection / caret in the card title; clear it so
  // nothing blinks there when focus returns on close.
  window.getSelection?.()?.removeAllRanges();
  const url = taskPanelUrl(window.location, taskId);
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

/** Close the panel: remove ?task= (always replace, so history and UI agree). */
export function closeTaskPanel() {
  window.getSelection?.()?.removeAllRanges();
  if (!new URLSearchParams(window.location.search).has("task")) return;
  window.history.replaceState(null, "", taskPanelUrl(window.location, ""));
}

const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * @param {{ taskId: string, href: string, replace?: boolean, className?: string,
 *           children: import("react").ReactNode } & Record<string, unknown>} props
 */
export default function TaskOpenLink({ taskId, href, replace = false, className, children, ...rest }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || !plainClick(e)) return;
        e.preventDefault();
        // Safari doesn't focus links on click: focus it so the dialog returns focus
        // here on close (programmatic focus after a pointer click shows no ring).
        e.currentTarget.focus({ preventScroll: true });
        openTaskPanel(taskId, { replace });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
