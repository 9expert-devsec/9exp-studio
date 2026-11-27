import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AllTasksSkeleton, AllTasksView, ViewToggle } from "@/components/tasks/AllTasksView";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import PinnedShellGuard from "@/components/shell/PinnedShellGuard";
import PageHeader from "@/components/ui/PageHeader";
import { getProjectViewer } from "@/lib/projects/access";
import { loadAllTasks } from "@/lib/tasks/allTasks";
import { parseAllTasks } from "@/lib/tasks/allTasksFilters";

export const metadata = {
  title: "All Tasks · 9Expert Studio",
};

// All Tasks (round 56, Figma 386:1241 and the grouped frames): every task the
// viewer may see (lib/tasks/allTasks.js), table view. All state lives in the URL
// (lib/tasks/allTasksFilters.js); filtering, sorting and paging are server-side.
//
// Pinned shell (round 52 pattern): header + tabs + toolbar never scroll; the table
// scrolls inside the in-app container. The ONE boundary below suspends only on the
// first visit; later URL changes keep the current page on screen until the new one
// is ready (router transitions), so nothing above the table ever jumps. Its
// fallback (AllTasksSkeleton) has the same rows at the same heights.
//
// A row opens the existing Task Detail panel HERE (?task=<id>, every other param
// kept); closing it (× / Esc / Back) leaves the same URL, so filters, tab,
// grouping, sort and page are all still there. Project-page origins are unchanged.
export default function AllTasksPage({ searchParams }) {
  return (
    <div data-pinned-shell data-pinned-root className="mx-auto flex w-full max-w-7xl flex-col gap-5 lg:min-h-0 lg:flex-1">
      <PinnedShellGuard />
      <div className="shrink-0">
        <PageHeader title="All Tasks" actions={<ViewToggle />}>
          <p className="-mt-1 text-sm text-fg-muted">ภาพรวมงานทุกประเภทจากทุกโปรเจกต์</p>
        </PageHeader>
      </div>
      <Suspense fallback={<AllTasksSkeleton />}>
        <AllTasksData searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <TaskDetailPanel />
      </Suspense>
    </div>
  );
}

async function AllTasksData({ searchParams }) {
  const viewer = await getProjectViewer();
  if (!viewer) redirect("/login");
  const f = parseAllTasks(await searchParams);
  const data = await loadAllTasks(viewer, f);
  return <AllTasksView f={f} data={data} />;
}
