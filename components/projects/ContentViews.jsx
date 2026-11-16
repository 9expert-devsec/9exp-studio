// Content tab views: content card, task card, empty states. No hooks
// (server-rendered); the ⋯ menu is a client island.

import Link from "next/link";
import { ChevronRight, ListChecks, Plus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { contentNumberLabel, formatShortDate } from "@/lib/projects/format";
import { statusInfo } from "@/lib/projects/status";
import { ContentMenu } from "./ProjectMenu";
import { ProgressBar, StatusChip } from "./ProjectBits";

/**
 * One content item. Description and brief are not shown (the brief is in the ⋯
 * menu). "All Tasks" is rendered but disabled until the Tasks round.
 */
export function ContentCard({ content }) {
  const { stats } = content;
  const s = statusInfo(content.status);
  return (
    <article aria-labelledby={`content-${content.id}`} className="overflow-hidden rounded-[16px] border border-line bg-card">
      <header className="flex min-h-14 items-center gap-3 border-b border-line-subtle bg-card-inset px-4 py-2 sm:px-5">
        <span className="shrink-0 text-sm font-semibold tabular-nums text-fg-muted">{content.numberLabel}</span>
        <h3 id={`content-${content.id}`} className="min-w-0 flex-1 truncate text-lg font-bold text-fg">
          {content.name}
        </h3>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex min-h-9 shrink-0 cursor-not-allowed items-center gap-0.5 rounded-full px-2 text-sm font-medium text-fg-muted opacity-60"
        >
          All Tasks
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
        <ContentMenu content={content} />
      </header>

      <div className="p-4 sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <p className="text-xs text-fg-muted">
            {stats.completed}/{stats.total} Tasks
          </p>
          <p className="flex items-baseline gap-2">
            <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
            <span className="text-2xl font-bold leading-none text-accent-fg">
              {stats.percent}
              <span className="text-base">%</span>
            </span>
          </p>
        </div>
        <ProgressBar value={stats.percent} tone="accent" label={`${content.name} progress`} className="mt-2.5" />

        <p className="mt-5 text-xs font-semibold text-fg">Recent Tasks</p>
        <div className="mt-2.5 grid gap-3 md:grid-cols-3">
          {stats.recentTasks.length > 0 ? (
            stats.recentTasks.slice(0, 3).map((t) => <TaskCard key={t.id} task={t} />)
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-[12px] bg-card-inset py-6 text-sm text-fg-muted md:col-span-3">
              <ListChecks className="size-4" aria-hidden="true" />
              No tasks yet
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function TaskPerson({ label, person }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {person ? (
        <Avatar name={person.name} url={person.avatarUrl} size={24} />
      ) : (
        <span aria-hidden="true" className="size-6 shrink-0 rounded-full bg-track" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] text-fg-muted">{label}</p>
        <p className="truncate text-xs font-medium text-fg">{person?.name ?? "Unassigned"}</p>
      </div>
    </div>
  );
}

/**
 * Task card for a content item's "Recent Tasks" row. Built now, rendered only when
 * contentStats() returns tasks (Tasks round). Shape: lib/projects/progress.js.
 */
export function TaskCard({ task }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-[14px] border border-line bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          Task {contentNumberLabel(task.number)}
        </span>
        {task.dueDate && <span className="text-[10px] text-fg-muted">Due {formatShortDate(task.dueDate)}</span>}
        <span className="ml-auto shrink-0">
          <StatusChip status={task.status} />
        </span>
      </div>
      <h4 className="truncate text-sm font-semibold text-fg">{task.title}</h4>
      <div className="grid grid-cols-2 gap-3 border-t border-line-subtle pt-3">
        <TaskPerson label="Created by" person={task.createdBy} />
        <TaskPerson label="Assigned to" person={task.assignee} />
      </div>
    </article>
  );
}

export function NoContent({ addHref }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-brand-500">
        <ListChecks className="size-6" aria-hidden="true" />
      </span>
      <h3 className="text-lg text-fg">No content yet</h3>
      {addHref && (
        <Link href={addHref} className={buttonClass("primary")}>
          <Plus className="size-4" aria-hidden="true" />
          Add content
        </Link>
      )}
    </Card>
  );
}

export function NoContentMatches({ clearHref }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-fg-muted">No content matches these filters</p>
      <Link href={clearHref} className={buttonClass("secondary")}>
        Clear filters
      </Link>
    </Card>
  );
}
