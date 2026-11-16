// Project list views: featured card, small card, and the list table. No hooks
// (server-rendered); the ⋯ menu is a client island.
//
// Card links: one full-cover <Link> per card, with the content above it set to
// pointer-events-none and the ⋯ menu re-enabled, so the menu never navigates and
// there are no nested interactive elements inside the <a>.

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { cardClass } from "@/components/ui/Card";
import { statusInfo } from "@/lib/projects/status";
import ProjectMenu from "./ProjectMenu";
import { AvatarStack, ProgressBar, ProjectIconTile, StatusChip, StatusDot, metaLine } from "./ProjectBits";

const dimmed = (p) => (p.status === "cancelled" ? "opacity-70" : "");

function CardLink({ project, radius }) {
  return (
    <Link
      href={project.href}
      aria-label={`Open ${project.name}`}
      className={`absolute inset-0 ${radius} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
    />
  );
}

export function FeaturedCard({ project }) {
  return (
    <article className={`${cardClass({ padded: false })} relative flex flex-col gap-5 p-5 transition-colors hover:border-brand-500/40 has-[[aria-expanded=true]]:z-20 ${dimmed(project)}`}>
      <CardLink project={project} radius="rounded-[24px]" />

      <div className="pointer-events-none relative flex gap-4">
        <ProjectIconTile icon={project.icon} size="lg" />
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-xs text-fg-muted">{metaLine(project)}</p>
          <h3 className="mt-1 truncate text-[22px] font-bold leading-tight text-fg">{project.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-fg-muted">{project.description || "No description"}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <span className="mt-2.5" title={statusInfo(project.status).label}>
            <StatusDot status={project.status} />
            <span className="sr-only">Status: {statusInfo(project.status).label}</span>
          </span>
          <ProjectMenu project={project} className="pointer-events-auto" />
        </div>
      </div>

      <div className="pointer-events-none relative grid gap-4 rounded-[16px] bg-card-inset p-4 sm:grid-cols-3">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-fg-muted">Project progress</span>
            <span className="font-semibold text-accent-fg">{project.progress}%</span>
          </div>
          <ProgressBar value={project.progress} className="mt-2.5" />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-xs text-fg-muted">Team</p>
          <AvatarStack people={project.team} />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-xs text-fg-muted">Project owner</p>
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={project.owner.name} url={project.owner.avatarUrl} size={24} />
            <span className="truncate text-sm font-medium text-fg">{project.owner.name}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProjectCard({ project }) {
  return (
    <article className={`${cardClass({ size: "sm", padded: false })} relative flex flex-col gap-4 p-4 transition-colors hover:border-brand-500/40 has-[[aria-expanded=true]]:z-20 ${dimmed(project)}`}>
      <CardLink project={project} radius="rounded-[18px]" />

      <div className="pointer-events-none relative flex items-center gap-3">
        <ProjectIconTile icon={project.icon} size="sm" />
        <div className="min-w-0">
          <p className="text-[11px] text-fg-muted">{metaLine(project)}</p>
          <h3 className="truncate text-sm font-bold text-fg">{project.name}</h3>
        </div>
      </div>

      <div className="pointer-events-none relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-fg-muted">
          <StatusDot status={project.status} />
          {statusInfo(project.status).label}
        </span>
        <ProjectMenu project={project} className="pointer-events-auto" />
      </div>

      <div className="pointer-events-none relative flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] text-fg-muted">Project progress</p>
          <ProgressBar value={project.progress} />
        </div>
        <div className="shrink-0">
          <p className="mb-1.5 text-[11px] text-fg-muted">Team</p>
          <AvatarStack people={project.team} />
        </div>
      </div>
    </article>
  );
}

const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted";
const td = "px-4 py-3 align-middle text-sm";

export function ProjectsTable({ projects }) {
  return (
    <div className={`${cardClass({ padded: false })} overflow-x-auto`}>
      <table className="w-full min-w-[880px]">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Project</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Progress</th>
            <th scope="col" className={th}>Team</th>
            <th scope="col" className={th}>Owner</th>
            <th scope="col" className={th}>Dates</th>
            <th scope="col" className={`${th} text-right`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {projects.map((p) => (
            <tr key={p.id} className={dimmed(p)}>
              <td className={td}>
                <Link
                  href={p.href}
                  className="flex min-w-0 items-center gap-3 rounded-[12px] font-semibold text-fg hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <ProjectIconTile icon={p.icon} size="sm" />
                  <span className="truncate">{p.name}</span>
                </Link>
              </td>
              <td className={td}>
                <StatusChip status={p.status} />
              </td>
              <td className={td}>
                <div className="flex w-32 items-center gap-2">
                  <ProgressBar value={p.progress} />
                  <span className="text-xs font-semibold text-accent-fg">{p.progress}%</span>
                </div>
              </td>
              <td className={td}>
                <AvatarStack people={p.team} />
              </td>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <Avatar name={p.owner.name} url={p.owner.avatarUrl} size={24} />
                  <span className="truncate text-fg">{p.owner.name}</span>
                </div>
              </td>
              <td className={`${td} whitespace-nowrap text-fg-muted`}>{p.datesLabel || "—"}</td>
              <td className={`${td} text-right`}>
                <ProjectMenu project={p} className="inline-block" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
