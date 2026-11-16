// Project detail header card (shared by every /projects/[id]/(tabs) route via the
// layout). No hooks: server-rendered; the ⋯ menu and Share are client islands.

import Link from "next/link";
import { CalendarDays, Pencil } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProjectMenu from "./ProjectMenu";
import ShareButton from "./ShareButton";
import { Chip, ProgressBar, ProjectIconTile, StatusChip } from "./ProjectBits";

export default function ProjectHeaderCard({ project }) {
  const cancelled = project.status === "cancelled";
  const { tasks } = project;

  return (
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
              <StatusChip status={project.status} />
              {project.datesLabel && (
                <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {project.datesLabel}
                </span>
              )}
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
  );
}
