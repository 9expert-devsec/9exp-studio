"use client";

// Tab bar for /projects/[id]/(tabs). Rendered ONCE by the shared layout; the active
// tab comes from the segments below that layout:
//   ["overview"] → Overview;  ["timeline"] → Timeline;  anything else ([], ["content", …]) → Content.
// (The breadcrumb is ProjectBreadcrumb, also rendered once by the layout — round 55.)
// useSelectedLayoutSegments suspends on this dynamic route (no
// generateStaticParams), so the layout renders this inside <Suspense>.

import { useEffect } from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { PROJECT_SCROLL_ID, TAB_BASE, TAB_IDLE_COLOR, TAB_LIST, TAB_NAV } from "./projectTopStyles";

// Round 55: classes shared with ProjectTopSkeleton (./projectTopStyles).
const tabActive = `${TAB_BASE} border-brand-500 font-semibold text-accent-fg`;
const tabIdle = `${TAB_BASE} ${TAB_IDLE_COLOR} hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500`;

/** Content · Timeline · Overview. Tabs are real links. */
export function ProjectTabs({ href }) {
  const segs = useSelectedLayoutSegments();
  const tab = segs[0] === "overview" || segs[0] === "timeline" ? segs[0] : "content";
  // Round 52: a new tab / page under the project starts at the top of the
  // in-app scroll container (the layout — and that container — persist).
  const page = segs.join("/");
  useEffect(() => {
    document.getElementById(PROJECT_SCROLL_ID)?.scrollTo({ top: 0 });
  }, [page]);
  const link = (key, to, text) => (
    <li>
      <Link href={to} aria-current={tab === key ? "page" : undefined} className={tab === key ? tabActive : tabIdle}>
        {text}
      </Link>
    </li>
  );
  return (
    <nav aria-label="Project sections" className={TAB_NAV}>
      <ul className={TAB_LIST}>
        {link("content", href, "Content")}
        {link("timeline", `${href}/timeline`, "Timeline")}
        {link("overview", `${href}/overview`, "Overview")}
      </ul>
    </nav>
  );
}
