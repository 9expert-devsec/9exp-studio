"use client";

import { useLayoutEffect, useRef } from "react";

// Round 54: keeps the pinned-shell flag only while the pinned page is VISIBLE.
//
// With cacheComponents, Next keeps a route you leave mounted but hidden (React
// <Activity mode="hidden">). The hidden project page would still contain
// [data-pinned-shell], so AppShell's `lg:has-[[data-pinned-shell]]:…` rules (full-
// height shell, overflow hidden, flex <main>) would keep applying on the next
// page — e.g. /projects squeezed to its content width and unable to scroll.
// Activity cleans up effects when it hides a route and re-runs them when it
// shows it again, so: remove the attribute on cleanup, restore it on setup. The
// server renders the attribute, so the first paint is already pinned.
export default function PinnedShellGuard() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const root = ref.current?.closest("[data-pinned-root]");
    if (!root) return undefined;
    root.setAttribute("data-pinned-shell", "");
    return () => root.removeAttribute("data-pinned-shell");
  }, []);
  return <span ref={ref} hidden />;
}
