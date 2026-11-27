import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import ProjectsToolbar from "@/components/projects/ProjectsToolbar";
import { CARD_GRID, FEATURED_GRID, FeaturedCard, PROJECTS_PAGE, ProjectCard, ProjectsTable } from "@/components/projects/ProjectViews";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { getProjectViewer } from "@/lib/projects/access";
import { parseProjectFilters, projectFiltersQuery } from "@/lib/projects/filters";
import { loadProjectsView } from "@/lib/projects/queries";

export const metadata = {
  title: "Projects · 9Expert Studio",
};

// Top-level menu page: no breadcrumb. searchParams and the session are request-time
// data, so both are read inside <Suspense> (cacheComponents; no `dynamic` export).
export default function ProjectsPage({ searchParams }) {
  return (
    <div className={PROJECTS_PAGE}>
      <PageHeader
        title="Projects"
        actions={
          <Suspense fallback={<ToolbarFallback />}>
            <ProjectsToolbar />
          </Suspense>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <ProjectsData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProjectsData({ searchParams }) {
  const viewer = await getProjectViewer();
  if (!viewer) redirect("/login");

  const filters = parseProjectFilters(await searchParams);
  const { total, projects, featured } = await loadProjectsView(viewer, filters);

  if (total === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-brand-500">
          <FolderKanban className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg text-fg">No projects yet</h2>
        <Link href="/projects/new" className={buttonClass("primary")}>
          <Plus className="size-4" aria-hidden="true" />
          Create project
        </Link>
      </Card>
    );
  }

  return (
    <>
      {filters.view === "grid" && featured.length > 0 && (
        <section aria-label="Featured projects" className={FEATURED_GRID}>
          {featured.map((p) => (
            <FeaturedCard key={p.id} project={p} />
          ))}
        </section>
      )}

      <section aria-labelledby="all-projects" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="all-projects" className="text-lg text-fg">All Projects</h2>
          <p className="text-sm text-fg-muted">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>

        {projects.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-fg-muted">No projects match these filters</p>
            <Link
              href={`/projects${projectFiltersQuery({ view: filters.view, statuses: [] })}`}
              className={buttonClass("secondary")}
            >
              Clear filters
            </Link>
          </Card>
        ) : filters.view === "list" ? (
          <ProjectsTable projects={projects} />
        ) : (
          <div className={CARD_GRID}>
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}

        <p className="text-sm text-fg-muted">
          Showing {projects.length} of {total} {total === 1 ? "project" : "projects"}
        </p>
      </section>
    </>
  );
}

function ToolbarFallback() {
  return <div className="h-[33px] w-72 animate-pulse rounded-full bg-track" aria-hidden="true" />;
}

/**
 * Mirrors the loaded grid view (round 54): the SAME featured / card grids as the
 * page, two ~295px featured cards, the "All Projects" heading row, and 8 ~225px
 * cards. It renders inside the page wrapper (PROJECTS_PAGE), so widths match.
 */
function ListSkeleton() {
  return (
    <>
      <div className={`${FEATURED_GRID} animate-pulse`} aria-hidden="true">
        {[0, 1].map((i) => (
          <span key={i} className="block h-[295px] rounded-[24px] bg-track" />
        ))}
      </div>
      <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
        <div className="flex items-baseline justify-between gap-3">
          <span className="block h-6 w-32 rounded bg-track" />
          <span className="block h-4 w-20 rounded bg-track" />
        </div>
        <div className={CARD_GRID}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="block h-[225px] rounded-[18px] bg-track" />
          ))}
        </div>
      </div>
    </>
  );
}
