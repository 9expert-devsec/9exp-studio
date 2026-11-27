import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProjectBreadcrumb, { ProjectCrumbProvider } from "@/components/projects/ProjectBreadcrumb";
import ProjectHeaderCard from "@/components/projects/ProjectHeaderCard";
import { ProjectTabs } from "@/components/projects/ProjectSectionNav";
import { PROJECT_SCROLL_ID } from "@/components/projects/projectTopStyles";
import PinnedShellGuard from "@/components/shell/PinnedShellGuard";
import { ProjectTopSkeleton } from "@/components/projects/Skeletons";
import { loadProjectDetail } from "@/lib/projects/queries";

// Shared by /projects/[id] (Content, default), /overview, /timeline, /content/new,
// /content/[contentId] and /content/[contentId]/edit: breadcrumb + header card +
// tabs render ONCE here. /projects/[id]/edit stays outside this route group.
// params and the session are request-time data → read inside <Suspense>. A project
// the viewer can't see is notFound() (same as a missing one); each page re-checks.
//
// Round 55 — the top section never moves:
// - ONE boundary (below) covers breadcrumb + header card + tabs. It suspends only
//   on first entry into a project (a layout is not re-rendered by a tab switch),
//   and its fallback (ProjectTopSkeleton) has the same three rows at the same
//   heights. The three real rows arrive together, never one at a time.
// - The breadcrumb is ProjectBreadcrumb (client): its last crumb follows the URL,
//   so a tab switch updates it without re-rendering or suspending anything here.
//   (It replaced the @crumbs parallel-route slot, which suspended per navigation.)
// - Every other loading boundary is INSIDE a tab page, i.e. inside #project-scroll,
//   under the tab bar.
//
// Round 52 — pinned header, in-app scroll (lg+): `data-pinned-shell` switches the
// AppShell to a full-height column; breadcrumb + header card + tabs are
// `shrink-0` and never scroll; the page below the tabs scrolls inside
// #project-scroll (thin themed `app-scrollbar`, its bar just right of the cards).
// The tabs reset that scroll on every page change (ProjectSectionNav.jsx). Below
// lg the container doesn't scroll on its own: the window scrolls as before.
// Round 54: `data-pinned-shell` is removed while this page is hidden by Next's
// preserved-route <Activity> (PinnedShellGuard), so it never pins another page.
export default function ProjectTabsLayout({ children, params }) {
  return (
    <ProjectCrumbProvider>
      <div data-pinned-shell data-pinned-root className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:min-h-0 lg:flex-1">
        <PinnedShellGuard />
        <div className="flex shrink-0 flex-col gap-6">
          <Suspense fallback={<ProjectTopSkeleton />}>
            <ProjectTop params={params} />
          </Suspense>
        </div>
        <div id={PROJECT_SCROLL_ID} className="app-scrollbar lg:-ml-1 lg:-mr-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-[26px] lg:pl-1 lg:pr-3">
          {children}
        </div>
      </div>
    </ProjectCrumbProvider>
  );
}

async function ProjectTop({ params }) {
  const { id } = await params;
  const project = await loadProjectDetail(id);
  if (!project) notFound();

  return (
    <>
      <ProjectBreadcrumb name={project.name} href={project.href} />
      <ProjectHeaderCard project={project} />
      <ProjectTabs href={project.href} />
    </>
  );
}
