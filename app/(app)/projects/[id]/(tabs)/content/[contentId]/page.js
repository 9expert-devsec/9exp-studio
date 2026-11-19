import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ContentSummaryCard, TasksSection } from "@/components/projects/ContentViews";
import { ContentListSkeleton } from "@/components/projects/Skeletons";
import { buttonClass } from "@/components/ui/Button";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { parseTaskFilters, taskFiltersQuery } from "@/lib/projects/filters";
import { loadContentDetail, loadProjectContext, loadTaskPanel } from "@/lib/projects/queries";

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

  const filters = parseTaskFilters(await searchParams);
  const content = await loadContentDetail(ctx, contentId, filters);
  if (!content) notFound();

  // Task Detail panel (?task=<id>). Hrefs keep this page's filters.
  const here = (next) => `${content.href}${taskFiltersQuery({ ...filters, newTask: false, editTask: "", ...next })}`;
  const panel = filters.task ? await loadTaskPanel(ctx.viewer, filters.task, { taskHref: (taskId) => here({ task: taskId }) }) : null;

  return (
    <div className="flex flex-col gap-6">
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
      {filters.task && <TaskDetailPanel open panel={panel} closeHref={here({ task: "" })} />}
      <TasksSection content={content} filters={filters} />
    </div>
  );
}
