import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProjectTimeline from "@/components/timeline/ProjectTimeline";
import { TimelineSkeleton } from "@/components/projects/Skeletons";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { loadProjectContext, loadTimeline } from "@/lib/projects/queries";

export const metadata = {
  title: "Project timeline · 9Expert Studio",
};

// Timeline tab (round 42): read-only Gantt of contents and tasks. Same access as
// the Content tab (loadProjectContext). params / session read inside <Suspense>.
// ?task= is the Task Detail panel's own client state (as on the Content tab).
export default function ProjectTimelinePage({ params }) {
  return (
    <Suspense fallback={<TimelineSkeleton />}>
      <TimelineTab params={params} />
    </Suspense>
  );
}

async function TimelineTab({ params }) {
  const { id } = await params;
  const ctx = await loadProjectContext(id);
  if (!ctx) notFound();

  const href = `/projects/${ctx.project._id}`;
  const data = await loadTimeline(ctx, href);

  return (
    <>
      <ProjectTimeline
        viewerId={ctx.viewer.idStr}
        projectId={ctx.project._id.toString()}
        contentHref={href}
        contents={data.contents}
        members={data.members}
        nowMs={data.nowMs}
      />
      <TaskDetailPanel />
    </>
  );
}
