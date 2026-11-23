import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProjectHeaderCard from "@/components/projects/ProjectHeaderCard";
import { ProjectTabs } from "@/components/projects/ProjectSectionNav";
import { ProjectHeaderSkeleton } from "@/components/projects/Skeletons";
import { loadProjectDetail } from "@/lib/projects/queries";

// Shared by /projects/[id] (Content, default), /overview, /timeline, /content/new,
// /content/[contentId] and /content/[contentId]/edit: breadcrumb + header card +
// tabs render ONCE here. /projects/[id]/edit stays outside this route group.
// The breadcrumb is the @crumbs parallel-route slot (it re-renders per navigation,
// so it can name the current content item; this layout does not).
// params and the session are request-time data → read inside <Suspense>. A project
// the viewer can't see is notFound() (same as a missing one); each page re-checks.
export default function ProjectTabsLayout({ children, crumbs, params }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      {crumbs}
      <Suspense fallback={<ProjectHeaderSkeleton />}>
        <ProjectHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function ProjectHeader({ params }) {
  const { id } = await params;
  const project = await loadProjectDetail(id);
  if (!project) notFound();

  return (
    <>
      <ProjectHeaderCard project={project} />
      <ProjectTabs href={project.href} />
    </>
  );
}
