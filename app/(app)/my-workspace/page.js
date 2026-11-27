import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AllTasksSkeleton, AllTasksView } from "@/components/tasks/AllTasksView";
import AllTasksViewToggle, { ViewToggleFallback } from "@/components/tasks/AllTasksViewToggle";
import { MyCards, MyTabs, MyWorkspaceTopSkeleton, WaitingReviewCard, WorkPlanTodayCard } from "@/components/tasks/MyWorkspaceTop";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import PinnedShellGuard from "@/components/shell/PinnedShellGuard";
import PageHeader from "@/components/ui/PageHeader";
import { getProjectViewer } from "@/lib/projects/access";
import { loadAllTasks, loadAllTasksCalendar, myTabCounts } from "@/lib/tasks/allTasks";
import { MY_OPEN_CHIPS, parseAllTasks } from "@/lib/tasks/allTasksFilters";
import { bangkokToday, cardDay, reviewSubline, workspaceSubtitle } from "@/lib/tasks/myWorkspace";
import { loadMyWorkspaceCards } from "@/lib/tasks/myWorkspaceStore";

export const metadata = {
  title: "My Workspace · 9Expert Studio",
};

// My Workspace (round 58, Figma 399:4309 งานของฉัน / 399:4715 งานที่เสร็จแล้ว): the
// tasks I WORK on (lib/tasks/myWorkspace.js isMine — reviewers never). It is the All
// Tasks page with scope "mine": the same URL state, loader, toolbar, filter modal,
// table, calendar, legend and skeleton (lib/tasks/allTasks*.js,
// components/tasks/AllTasks*.jsx), plus the main tabs and — on งานของฉัน — the
// "Work Plan วันนี้" and "รอฉันตรวจ" cards (components/tasks/MyWorkspaceTop.jsx,
// lib/tasks/myWorkspaceStore.js).
//
// Same page rules as All Tasks: the top (title, tabs, cards, chips, toolbar) never
// scrolls; the table scrolls inside its card (sticky header, pinned footer); every
// state is in the URL; a row opens Task Detail here (?task=) and closing keeps it all.
export default function MyWorkspacePage({ searchParams }) {
  return (
    <div data-pinned-shell data-pinned-root className="mx-auto flex w-full max-w-7xl flex-col gap-5 lg:min-h-0 lg:flex-1">
      <PinnedShellGuard />
      <div className="shrink-0">
        <PageHeader
          title="My Workspace"
          actions={
            <Suspense fallback={<ViewToggleFallback />}>
              <AllTasksViewToggle />
            </Suspense>
          }
        >
          <Suspense fallback={<p className="-mt-1 text-sm text-transparent">งานของ…</p>}>
            <Subtitle />
          </Suspense>
        </PageHeader>
      </div>
      <Suspense fallback={<AllTasksSkeleton header={<MyWorkspaceTopSkeleton />} chips={MY_OPEN_CHIPS} pill />}>
        <MyWorkspaceData searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <TaskDetailPanel />
      </Suspense>
    </div>
  );
}

/** "งานของ{name} · ศุกร์ 27 พ.ย. 2569" (the name the account menu shows). */
async function Subtitle() {
  const viewer = await getProjectViewer();
  await connection();
  return <p className="-mt-1 text-sm text-fg-muted">{workspaceSubtitle(viewer?.user?.name ?? "", bangkokToday())}</p>;
}

async function MyWorkspaceData({ searchParams }) {
  const viewer = await getProjectViewer();
  if (!viewer) redirect("/login");
  await connection();
  const f = parseAllTasks(await searchParams, "mine");
  const tabs = await myTabCounts(viewer);
  const cards = f.ws === "open" ? await loadMyWorkspaceCards(viewer, tabs.projectIds) : null;
  const data =
    f.view === "calendar" ? await loadAllTasksCalendar(viewer, f) : await loadAllTasks(viewer, f, { planCounts: cards?.planCounts ?? null });
  const header = (
    <>
      <MyTabs f={f} counts={tabs} />
      {cards && (
        <MyCards>
          <WorkPlanTodayCard dayLabel={cardDay(cards.todayKey)} workPlan={cards.workPlan} />
          {/* Review Queue has no page yet (components/shell/nav.js href null): disabled link. */}
          <WaitingReviewCard count={cards.reviews.count} subline={reviewSubline(cards.reviews, cards.todayKey)} href={null} />
        </MyCards>
      )}
    </>
  );
  return <AllTasksView f={f} data={data} header={header} />;
}
