import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProjectHeaderCard from "@/components/projects/ProjectHeaderCard";
import { PROJECT_SCROLL_ID, ProjectTabs } from "@/components/projects/ProjectSectionNav";
import PinnedShellGuard from "@/components/shell/PinnedShellGuard";
import { ProjectHeaderSkeleton } from "@/components/projects/Skeletons";
import { loadProjectDetail } from "@/lib/projects/queries";

// Shared by /projects/[id] (Content, default), /overview, /timeline, /content/new,
// /content/[contentId] and /content/[contentId]/edit: breadcrumb + header card +
// tabs render ONCE here. /projects/[id]/edit stays outside this route group.
// The breadcrumb is the @crumbs parallel-route slot (it re-renders per navigation,
// so it can name the current content item; this layout does not).
// params and the session are request-time data → read inside <Suspense>. A project
// the viewer can't see is notFound() (same as a missing one); each page re-checks.
//
// Round 52 — pinned header, in-app scroll (lg+): `data-pinned-shell` switches the
// AppShell to a full-height column; breadcrumb + header card + tabs are
// `shrink-0` and never scroll; the page below the tabs scrolls inside
// #project-scroll (thin themed `app-scrollbar`, its bar just right of the cards).
// The tabs reset that scroll on every page change (ProjectSectionNav.jsx). Below
// lg the container doesn't scroll on its own: the window scrolls as before.
// Round 54: `data-pinned-shell` is removed while this page is hidden by Next's
// preserved-route <Activity> (PinnedShellGuard), so it never pins another page.
export default function ProjectTabsLayout({ children, crumbs, params }) {
  return (
    <div data-pinned-shell data-pinned-root className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:min-h-0 lg:flex-1">
      <PinnedShellGuard />
      <div className="flex shrink-0 flex-col gap-6">
        {crumbs}
        <Suspense fallback={<ProjectHeaderSkeleton />}>
          <ProjectHeader params={params} />
        </Suspense>
      </div>
      <div id={PROJECT_SCROLL_ID} className="app-scrollbar lg:-ml-1 lg:-mr-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-[26px] lg:pl-1 lg:pr-3">
        {children}
      </div>
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
