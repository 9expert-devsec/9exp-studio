import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ExternalLink, Link2, ListChecks, Pencil, Plus } from "lucide-react";
import { Chip, ProgressBar, ProjectIconTile, StatusChip } from "@/components/projects/ProjectBits";
import ProjectMenu from "@/components/projects/ProjectMenu";
import ShareButton from "@/components/projects/ShareButton";
import { DetailSkeleton } from "@/components/projects/Skeletons";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import IconButton from "@/components/ui/IconButton";
import PageHeader from "@/components/ui/PageHeader";
import { getProjectViewer } from "@/lib/projects/access";
import { loadProjectDetail } from "@/lib/projects/queries";

export const metadata = {
  title: "Project · 9Expert Studio",
};

// Nested page: breadcrumb "Projects / {name}". A project the viewer can't see is
// notFound() (same as a missing one). params is read inside <Suspense>.
export default function ProjectDetailPage({ params }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Suspense fallback={<DetailSkeleton />}>
        <ProjectDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ProjectDetail({ params }) {
  const { id } = await params;
  const viewer = await getProjectViewer();
  const project = viewer ? await loadProjectDetail(viewer, id) : null;
  if (!project) notFound();

  const cancelled = project.status === "cancelled";
  const { tasks } = project;

  return (
    <>
      <PageHeader breadcrumb={[{ label: "Projects", href: "/projects" }, { label: project.name }]} />

      {/* Header card */}
      <Card
        padded={false}
        className={`flex flex-col gap-6 bg-linear-to-br from-accent-soft to-card p-5 sm:p-6 ${cancelled ? "opacity-80" : ""}`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4 sm:gap-5">
            <ProjectIconTile icon={project.icon} size="lg" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Project name</p>
              <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-fg sm:text-[28px]">{project.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip>{project.typeLabel}</Chip>
                <StatusChip status={project.status} suffix="Auto" />
                <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {project.datesLong}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ShareButton href={project.href} />
            {project.canEdit && (
              <Link href={`${project.href}/edit`} className={buttonClass("primary")}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit project
              </Link>
            )}
            {(project.canCancel || project.canReopen) && (
              <ProjectMenu project={project} showOpen={false} showPin={false} showCopy={false} showEdit={false} />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-4">
            <p className="text-sm text-fg-muted">
              Project progress · {tasks.completed} of {tasks.total} tasks completed
            </p>
            <p className="text-3xl font-bold text-fg">{project.progress}%</p>
          </div>
          <ProgressBar value={project.progress} className="mt-3" />
        </div>
      </Card>

      {/* Tabs (only Overview exists yet) */}
      <nav aria-label="Project sections" className="border-b border-line">
        <ul className="-mb-px flex gap-1">
          <li>
            <span aria-current="page" className="inline-flex min-h-11 items-center border-b-2 border-brand-500 px-4 text-sm font-semibold text-fg">
              Overview
            </span>
          </li>
          {["Content", "Timeline"].map((t) => (
            <li key={t}>
              <span
                aria-disabled="true"
                title="Coming soon"
                className="inline-flex min-h-11 cursor-not-allowed items-center border-b-2 border-transparent px-4 text-sm font-medium text-fg-muted opacity-60"
              >
                {t}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {/* Overview */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card as="section" aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="text-lg text-fg">Description</h2>
            {project.description ? (
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-fg">{project.description}</p>
            ) : (
              <p className="mt-3 text-sm text-fg-muted">No description</p>
            )}
            {project.briefLink && (
              <a
                href={project.briefLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-3 rounded-[14px] bg-card-inset px-4 py-3 transition-colors hover:bg-track focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <Link2 className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Brief link</span>
                  <span className="block truncate text-sm text-fg">{project.briefLink}</span>
                </span>
                <ExternalLink className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Total tasks", tasks.total],
              ["Completed", tasks.completed],
              ["In progress", tasks.inProgress],
              ["Open", tasks.open],
            ].map(([label, value]) => (
              <Card key={label} size="sm">
                <p className="text-xs text-fg-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-fg">{value}</p>
              </Card>
            ))}
          </div>

          <Card as="section" aria-labelledby="tasks-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="tasks-heading" className="text-lg text-fg">Recent tasks</h2>
                <p className="text-sm text-fg-muted">Next up for this project</p>
              </div>
              <button type="button" disabled className={buttonClass("secondary", "min-h-9")} title="Coming soon">
                View all
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 flex flex-col items-center gap-2 rounded-[14px] bg-card-inset py-10 text-center">
              <ListChecks className="size-6 text-fg-muted" aria-hidden="true" />
              <p className="text-sm text-fg-muted">No tasks yet</p>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card as="section" aria-labelledby="members-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="members-heading" className="text-lg text-fg">Project Members</h2>
                <p className="text-sm text-fg-muted">
                  {project.memberCount} {project.memberCount === 1 ? "member" : "members"}
                </p>
              </div>
              {project.canEdit && (
                <IconButton icon={Plus} label="Add members" href={`${project.href}/edit#members`} />
              )}
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {project.team.map((person, i) => (
                <li key={person.id} className="flex items-center gap-3">
                  <Avatar name={person.name} url={person.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{person.name}</p>
                    <p className="truncate text-xs text-fg-muted">{person.roleName || " "}</p>
                  </div>
                  {i === 0 && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-fg">Owner</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card as="section" aria-labelledby="info-heading">
            <h2 id="info-heading" className="text-lg text-fg">Project info</h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Project Type</dt>
                <dd className="font-medium text-fg">{project.typeLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Start Date</dt>
                <dd className="font-medium text-fg">{project.startDateLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">End Date</dt>
                <dd className="font-medium text-fg">{project.endDateLabel}</dd>
              </div>
              <div className="border-t border-line-subtle" />
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">Project Status (auto)</dt>
                <dd>
                  <StatusChip status={project.status} />
                </dd>
              </div>
              {project.cancelledAtLabel && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Cancelled on</dt>
                  <dd className="font-medium text-danger">{project.cancelledAtLabel}</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 rounded-[12px] bg-card-inset px-3 py-2 text-xs text-fg-muted">
              Updated automatically from task progress
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
