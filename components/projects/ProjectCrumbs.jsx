// Breadcrumb for the /projects/[id]/(tabs) routes, rendered by the layout's @crumbs
// parallel-route slot (@crumbs/page.js + @crumbs/[...rest]/page.js). A slot page
// re-renders on EVERY navigation under the project, unlike the shared layout, so it
// can name the current content item. `rest` = segments below the layout:
//   []                         → Projects / {project} / Content
//   ["overview"]               → Projects / {project} / Overview
//   ["timeline"]               → Projects / {project} / Timeline
//   ["content", "new"]         → … / Content / Create Content
//   ["content", <id>]          → … / Content / {content name}
//   ["content", <id>, "edit"]  → … / Content / Edit Content
// The layout and the pages do the notFound() checks; this only renders labels.

import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { findProjectContent } from "@/lib/projects/access";
import { loadProjectContext } from "@/lib/projects/queries";

export default function ProjectCrumbs({ params }) {
  return (
    <Suspense fallback={<span className="block h-4 w-56 animate-pulse rounded bg-track" aria-hidden="true" />}>
      <Crumbs params={params} />
    </Suspense>
  );
}

async function Crumbs({ params }) {
  const { id, rest = [] } = await params;
  const ctx = await loadProjectContext(id);
  if (!ctx) return null;

  const href = `/projects/${ctx.project._id}`;
  const trail = [
    { label: "Projects", href: "/projects" },
    { label: ctx.project.name, href },
  ];

  if (rest[0] === "overview") {
    trail.push({ label: "Overview" });
  } else if (rest[0] === "timeline") {
    trail.push({ label: "Timeline" });
  } else if (rest[0] === "content" && rest[1] === "new") {
    trail.push({ label: "Content", href }, { label: "Create Content" });
  } else if (rest[0] === "content" && rest[1] && rest[2] === "edit") {
    trail.push({ label: "Content", href }, { label: "Edit Content" });
  } else if (rest[0] === "content" && rest[1] && rest.length === 2) {
    const content = await findProjectContent(ctx.project, rest[1]);
    trail.push({ label: "Content", href }, ...(content ? [{ label: content.name }] : []));
  } else {
    trail.push({ label: "Content" });
  }

  return <PageHeader breadcrumb={trail} />;
}
