import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ProjectCrumbLabel } from "@/components/projects/ProjectBreadcrumb";
import { ContentSummaryCard, TasksSection } from "@/components/projects/ContentViews";
import { ContentListSkeleton } from "@/components/projects/Skeletons";
import { buttonClass } from "@/components/ui/Button";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { parseTaskFilters } from "@/lib/projects/filters";
import { loadContentDetail, loadProjectContext } from "@/lib/projects/queries";

export const metadata = {
  title: "Content · 9Expert Studio",
};

// Content detail (inside the shared project layout; Content tab active). A contentId
// that doesn't belong to this project, or a project the viewer can't see → notFound().
// Tasks toolbar state (?q=&status=&sort=&view=) is parsed from searchParams on every
// render; params/searchParams/session are read inside <Suspense>.
export default function ContentDetailPage({ params, searchParams }) {
  return (
    <Suspense fallback={<ContentListSkeleton />}>
      <ContentDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ContentDetail({ params, searchParams }) {
  const { id, contentId } = await params;
  const ctx = await loadProjectContext(id);
  if (!ctx) notFound();

  // ?task= is the Task Detail panel's own client state (TaskDetailPanel loads its
  // data); ignored here so no server-rendered link carries a stale ?task=.
  const filters = { ...parseTaskFilters(await searchParams), task: "" };
  const content = await loadContentDetail(ctx, contentId, filters);
  if (!content) notFound();

  return (
    <div className="flex flex-col gap-6">
      {/* Round 55: the layout's breadcrumb (never unmounted) shows this name last. */}
      <ProjectCrumbLabel label={content.name} />
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Link href={content.projectHref} className={buttonClass("outline", "min-h-9")}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to contents
        </Link>
        <p className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="text-fg-muted">Content</span>
          <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <span className="truncate font-medium text-fg">{content.name}</span>
        </p>
      </div>

      <ContentSummaryCard content={content} />
      {/* Before TasksSection: the panel opens (showModal) first, so the Edit drawer
          (?editTask) stacks on top of it. */}
      <TaskDetailPanel />
      <TasksSection content={content} filters={filters} />
    </div>
  );
}
