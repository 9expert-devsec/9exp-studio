"use client";

// Tab bar for /projects/[id]/(tabs). Rendered ONCE by the shared layout; the active
// tab comes from the segments below that layout:
//   ["overview"]  → Overview;   anything else ([], ["content", …]) → Content.
// (The breadcrumb is the layout's @crumbs slot, built on the server.)
// useSelectedLayoutSegments suspends on this dynamic route (no
// generateStaticParams), so the layout renders this inside <Suspense>.

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";

const tabBase = "inline-flex min-h-11 items-center border-b-2 px-4 text-sm";
const tabActive = `${tabBase} border-brand-500 font-semibold text-accent-fg`;
const tabIdle = `${tabBase} border-transparent font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500`;

/** Content · Timeline (disabled) · Overview. Tabs are real links. */
export function ProjectTabs({ href }) {
  const segs = useSelectedLayoutSegments();
  const tab = segs[0] === "overview" ? "overview" : "content";
  const link = (key, to, text) => (
    <li>
      <Link href={to} aria-current={tab === key ? "page" : undefined} className={tab === key ? tabActive : tabIdle}>
        {text}
      </Link>
    </li>
  );
  return (
    <nav aria-label="Project sections" className="border-b border-line">
      <ul className="-mb-px flex gap-1">
        {link("content", href, "Content")}
        <li>
          <span
            aria-disabled="true"
            title="Coming soon"
            className={`${tabBase} cursor-not-allowed border-transparent font-medium text-fg-muted opacity-60`}
          >
            Timeline
          </span>
        </li>
        {link("overview", `${href}/overview`, "Overview")}
      </ul>
    </nav>
  );
}
