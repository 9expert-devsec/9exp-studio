import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProjectHeaderCard from "@/components/projects/ProjectHeaderCard";
import { ProjectCrumbs, ProjectTabs } from "@/components/projects/ProjectSectionNav";
import { ProjectHeaderSkeleton } from "@/components/projects/Skeletons";
import { loadProjectDetail } from "@/lib/projects/queries";

// Shared by /projects/[id] (Content, default), /overview, /content/new and
// /content/[contentId]/edit: breadcrumb + header card + tabs render ONCE here.
// /projects/[id]/edit stays outside this route group.
// params and the session are request-time data → read inside <Suspense>. A project
// the viewer can't see is notFound() (same as a missing one); each page re-checks.
export default function ProjectTabsLayout({ children, params }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
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
      <ProjectCrumbs name={project.name} href={project.href} />
      <ProjectHeaderCard project={project} />
      <ProjectTabs href={project.href} />
    </>
  );
}
