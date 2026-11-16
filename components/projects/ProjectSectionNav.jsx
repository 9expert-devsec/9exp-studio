"use client";

// Breadcrumb + tab bar for /projects/[id]/(tabs). Rendered ONCE by the shared
// layout; the active section comes from the segments below that layout:
//   []                           → Content (default tab)
//   ["overview"]                 → Overview
//   ["content", "new"]           → Content · Create Content
//   ["content", <id>, "edit"]    → Content · Edit Content
// useSelectedLayoutSegments suspends on this dynamic route (no
// generateStaticParams), so the layout renders these inside <Suspense>.

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

function useSection() {
  const segs = useSelectedLayoutSegments();
  if (segs[0] === "overview") return { tab: "overview", sub: null };
  if (segs[0] === "content" && segs[1] === "new") return { tab: "content", sub: "Create Content" };
  if (segs[0] === "content" && segs[2] === "edit") return { tab: "content", sub: "Edit Content" };
  return { tab: "content", sub: null };
}

export function ProjectCrumbs({ name, href }) {
  const { tab, sub } = useSection();
  const trail = [
    { label: "Projects", href: "/projects" },
    { label: name, href },
    tab === "overview" ? { label: "Overview" } : { label: "Content", href: sub ? href : undefined },
    ...(sub ? [{ label: sub }] : []),
  ];
  return <PageHeader breadcrumb={trail} />;
}

const tabBase = "inline-flex min-h-11 items-center border-b-2 px-4 text-sm";
const tabActive = `${tabBase} border-brand-500 font-semibold text-accent-fg`;
const tabIdle = `${tabBase} border-transparent font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500`;

/** Content · Timeline (disabled) · Overview. Tabs are real links. */
export function ProjectTabs({ href }) {
  const { tab } = useSection();
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
