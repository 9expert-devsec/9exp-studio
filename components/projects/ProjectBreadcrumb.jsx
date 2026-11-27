"use client";

// Round 55: the project breadcrumb, rendered ONCE by the (tabs) layout next to the
// header card and the tabs (it replaced the @crumbs parallel-route slot, which
// re-rendered — and suspended to a 16px placeholder — on every tab switch).
// The trail comes from the URL on the client; only the project name / href come
// from the layout's data. Segments below the layout:
//   []                         → Projects / {project} / Content
//   ["overview"]               → Projects / {project} / Overview
//   ["timeline"]               → Projects / {project} / Timeline
//   ["content", "new"]         → … / Content / Create Content
//   ["content", <id>]          → … / Content / {content name}
//   ["content", <id>, "edit"]  → … / Content / Edit Content
// The content name is the one crumb the layout can't know: the content detail page
// supplies it with <ProjectCrumbLabel> (context). Until it arrives the row shows
// "… / Content" — the row itself never unmounts and its height is fixed (h-6).
// Round 52 rule kept: a trailing tab crumb is `tab: true`, so back → /projects.

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useSelectedLayoutSegments } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

const CrumbContext = createContext(null);

/** Wraps the (tabs) layout so a page can name its own last crumb. */
export function ProjectCrumbProvider({ children }) {
  const [extra, setExtra] = useState(null); // { path, label } | null
  return <CrumbContext.Provider value={{ extra, setExtra }}>{children}</CrumbContext.Provider>;
}

/** Rendered by a page (content detail): its name as the last crumb, for its own URL only. */
export function ProjectCrumbLabel({ label }) {
  const setExtra = useContext(CrumbContext)?.setExtra;
  const path = usePathname();
  useEffect(() => {
    if (!setExtra) return undefined;
    setExtra({ path, label });
    // Cleared on unmount AND when Next's preserved-route <Activity> hides the page.
    return () => setExtra((cur) => (cur?.path === path ? null : cur));
  }, [setExtra, path, label]);
  return null;
}

export default function ProjectBreadcrumb({ name, href }) {
  const segs = useSelectedLayoutSegments();
  const path = usePathname();
  const extra = useContext(CrumbContext)?.extra;

  const trail = [
    { label: "Projects", href: "/projects" },
    { label: name, href },
  ];
  if (segs[0] === "overview") {
    trail.push({ label: "Overview", tab: true });
  } else if (segs[0] === "timeline") {
    trail.push({ label: "Timeline", tab: true });
  } else if (segs[0] === "content" && segs[1] === "new") {
    trail.push({ label: "Content", href }, { label: "Create Content" });
  } else if (segs[0] === "content" && segs[1] && segs[2] === "edit") {
    trail.push({ label: "Content", href }, { label: "Edit Content" });
  } else if (segs[0] === "content" && segs[1]) {
    trail.push({ label: "Content", href }, ...(extra?.path === path && extra.label ? [{ label: extra.label }] : []));
  } else {
    trail.push({ label: "Content", tab: true });
  }

  return <PageHeader breadcrumb={trail} />;
}
