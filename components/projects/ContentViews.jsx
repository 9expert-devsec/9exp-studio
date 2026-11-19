// Content views: content card + empty states (Content tab), the content detail
// summary card + Tasks section (cards / table), and the task card. No hooks
// (server-rendered); the ⋯ menus and the toolbar are client islands.

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  Pencil,
  Plus,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import Card, { cardClass } from "@/components/ui/Card";
import { taskFiltersQuery } from "@/lib/projects/filters";
import { statusInfo } from "@/lib/projects/status";
import { getTaskType } from "@/lib/tasks/types";
import ContentToolbar from "./ContentToolbar";
import CreateTaskDrawer from "./CreateTaskDrawer";
import { ContentMenu, TaskMenu } from "./ProjectMenu";
import { ProgressBar, ProjectIconTile, StatusChip } from "./ProjectBits";
import SortableBoard from "./SortableBoard";
import AssetStatusChip from "@/components/tasks/AssetStatusChip";
import TaskOpenLink from "@/components/tasks/TaskOpenLink";

/**
 * "{completed}/{total} Tasks" · status label · big % · accent bar (card + detail).
 * `prominentCount` (the Content tab card): the count line one size up, in the
 * normal foreground colour, numbers semibold.
 */
export function ContentProgress({ name, status, stats, prominentCount = false }) {
  const s = statusInfo(status);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        {prominentCount ? (
          <p className="text-sm text-fg">
            <span className="font-semibold tabular-nums">
              {stats.completed}/{stats.total}
            </span>{" "}
            Tasks
          </p>
        ) : (
          <p className="text-xs text-fg-muted">
            {stats.completed}/{stats.total} Tasks
          </p>
        )}
        <p className="flex items-baseline gap-2">
          <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
          <span className="text-2xl font-bold leading-none text-accent-fg">
            {stats.percent}
            <span className="text-base">%</span>
          </span>
        </p>
      </div>
      <ProgressBar value={stats.percent} tone="accent" label={`${name} progress`} className="mt-2.5" />
    </div>
  );
}

/**
 * One content item. The header (number + name) and "All Tasks ›" link to the
 * content detail page; the ⋯ menu is a sibling (not inside a link), so it never
 * navigates. Description and brief are not shown (the brief is in the ⋯ menu).
 */
export function ContentCard({ content }) {
  const { stats } = content;
  return (
    <article aria-labelledby={`content-${content.id}`} className="overflow-hidden rounded-[16px] border border-line bg-card">
      <header className="flex min-h-14 items-center gap-3 border-b border-line-subtle bg-card-inset px-4 py-2 sm:px-5">
        <Link
          href={content.href}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-[10px] focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <span className="shrink-0 text-sm font-semibold tabular-nums text-fg-muted">{content.numberLabel}</span>
          <h3 id={`content-${content.id}`} className="min-w-0 truncate text-lg font-bold text-fg group-hover:text-accent-fg">
            {content.name}
          </h3>
        </Link>
        <Link
          href={content.href}
          aria-label={`All tasks for ${content.name}`}
          className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-full px-2 text-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          All Tasks
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
        <ContentMenu content={content} />
      </header>

      <div className="p-4 sm:p-5">
        <ContentProgress name={content.name} status={content.status} stats={stats} prominentCount />

        {/* The first 3 tasks in manual (drag) order; dragging among them saves the full order. */}
        <p className="mt-5 text-xs font-semibold text-fg">Preview tasks</p>
        <div className="mt-2.5">
          {stats.recentTasks.length > 0 ? (
            <SortableBoard
              kind="tasks"
              label={`Tasks of ${content.name}`}
              projectId={content.projectId}
              contentId={content.id}
              items={stats.recentTasks.slice(0, 3).map((t) => ({ id: t.id, node: <TaskCard task={t} /> }))}
              fullOrder={content.taskOrder}
              canReorder={!!content.canReorderTasks}
            />
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-[12px] bg-card-inset py-6 text-sm text-fg-muted">
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

/** Muted type indicator (catalog icon + label), so mixed types are readable. */
function TaskTypeTag({ type, label }) {
  const Icon = getTaskType(type)?.icon ?? ListChecks;
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-fg-muted">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Status chip: the catalog's Thai label, coloured by its group. */
const TaskStatusChip = ({ task }) => <StatusChip status={task.group} label={task.statusLabel} />;

const dueLabel = (task) => task.dueAtLabel || "No due date";

/** Tiny work-level pill (Clip details). */
const WorkLevelPill = ({ label }) =>
  label ? (
    <span className="shrink-0 rounded-full bg-track px-2 py-0.5 text-[10px] font-semibold text-fg-muted">{label}</span>
  ) : null;

/**
 * Task card: the content card's "Tasks" (compact: due date in the body, no
 * menu) and, withFooter, the content detail Cards view, whose footer strip carries
 * the due date (left) and the task ⋯ menu (right). Shape: queries.js taskView().
 */
export function TaskCard({ task, withFooter = false }) {
  return (
    <article
      aria-label={`TASK ${task.numberLabel}: ${task.title}`}
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-card ${
        task.openHref ? "transition-colors hover:border-brand-500/60" : ""
      }`}
    >
      <TaskCardBody task={task} showDue={!withFooter} />
      {withFooter && (
        <div className="flex min-h-11 items-center justify-between gap-2 border-t border-line-subtle bg-card-inset px-3.5 py-1.5">
          <span className={`inline-flex items-center gap-1.5 text-xs ${task.dueAt ? "text-fg" : "text-fg-muted"}`}>
            <CalendarDays className="size-3.5 text-fg-muted" aria-hidden="true" />
            {dueLabel(task)}
          </span>
          <TaskMenu task={task} />
        </div>
      )}
    </article>
  );
}

function TaskCardBody({ task, showDue }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          Task {task.numberLabel}
        </span>
        <TaskTypeTag type={task.type} label={task.typeLabel} />
        <WorkLevelPill label={task.workLevelLabel} />
        <span className="ml-auto shrink-0">
          <TaskStatusChip task={task} />
        </span>
      </div>
      <h4 className="line-clamp-2 break-words text-sm font-semibold text-fg">
        {task.openHref ? (
          // Stretched link: the whole card opens the Task Detail panel (?task=<id>,
          // pushed without a page round-trip — TaskOpenLink). The ⋯ menu sits above
          // it (relative z-10); a drag never clicks (round 30). Focus ring for
          // keyboard focus only (:focus-visible).
          <TaskOpenLink
            taskId={task.id}
            href={task.openHref}
            className="rounded outline-none after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {task.title}
          </TaskOpenLink>
        ) : (
          task.title
        )}
      </h4>
      {(showDue || task.assetStatusLabel) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
          {showDue && <span>{task.dueAt ? `Due ${dueLabel(task)}` : "No due date"}</span>}
          <AssetStatusChip status={task.assetStatus} label={task.assetStatusLabel} />
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 border-t border-line-subtle pt-3">
        <TaskPerson label="Created by" person={task.createdBy} />
        <TaskPerson label="Assigned to" person={task.assignee} />
      </div>
    </div>
  );
}

const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted";
const td = "px-4 py-3 align-middle text-sm";

/**
 * Content detail Table view: same order as the Cards view (manual by default),
 * not draggable. The Due date header switches to a due-date sort. Row checkboxes
 * are inert (bulk actions later).
 */
export function TasksTable({ tasks, sort, sortHref }) {
  const desc = sort === "due_desc";
  return (
    <div className={`${cardClass({ size: "sm", padded: false })} overflow-x-auto`}>
      <table className="w-full min-w-[860px]">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={`${th} w-10`}>
              <span className="sr-only">Select</span>
            </th>
            <th scope="col" className={th}>ID</th>
            <th scope="col" className={th}>Task</th>
            <th scope="col" className={th}>Assignee</th>
            <th scope="col" className={th} aria-sort={desc ? "descending" : sort === "due_asc" ? "ascending" : "none"}>
              <Link href={sortHref} scroll={false} replace className="inline-flex items-center gap-1 rounded hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500">
                Due date
                {desc ? (
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                ) : sort === "due_asc" ? (
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                ) : null}
              </Link>
            </th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Asset</th>
            <th scope="col" className={`${th} text-right`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {tasks.map((t) => {
            const idLabel = `TASK ${t.numberLabel}`;
            return (
              <tr key={t.id}>
                <td className={td}>
                  <input type="checkbox" aria-label={`Select ${idLabel}`} className="size-4 accent-brand-500" />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-fg-muted">{idLabel}</span>
                  <span className="flex items-center gap-1.5">
                    <TaskTypeTag type={t.type} label={t.typeLabel} />
                    <WorkLevelPill label={t.workLevelLabel} />
                  </span>
                </td>
                <td className={`${td} max-w-xs truncate font-semibold text-fg`} title={t.title}>
                  {t.openHref ? (
                    <TaskOpenLink
                      taskId={t.id}
                      href={t.openHref}
                      className="rounded outline-none hover:text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
                    >
                      {t.title}
                    </TaskOpenLink>
                  ) : (
                    t.title
                  )}
                </td>
                <td className={td}>
                  {t.assignee ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={t.assignee.name} url={t.assignee.avatarUrl} size={24} />
                      <span className="truncate text-fg">{t.assignee.name}</span>
                    </span>
                  ) : (
                    <span className="text-fg-muted">Unassigned</span>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap text-fg-muted`}>{t.dueAtLabel || "—"}</td>
                <td className={td}>
                  <TaskStatusChip task={t} />
                </td>
                <td className={td}>
                  {t.assetStatusLabel ? (
                    <AssetStatusChip status={t.assetStatus} label={t.assetStatusLabel} />
                  ) : (
                    <span className="text-fg-muted">—</span>
                  )}
                </td>
                <td className={`${td} text-right`}>
                  <span className="inline-flex justify-end">
                    <TaskMenu task={t} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MetaItem({ icon: Icon, avatar, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-3 sm:px-5 sm:first:pl-0 sm:last:pr-0">
      {avatar ?? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card-inset text-fg-muted">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <dt className="text-xs text-fg-muted">{label}</dt>
        <dd className="truncate text-sm font-medium text-fg">{value}</dd>
      </div>
    </div>
  );
}

/**
 * Content detail summary card: tile (FileText in the PROJECT's icon colour) · name ·
 * Edit content + ⋯ (Open brief / Copy brief link / Delete content) · description +
 * brief box · progress · Due date / Created by / Last Updated.
 */
export function ContentSummaryCard({ content }) {
  return (
    <section aria-labelledby="content-title" className="flex flex-col gap-5 rounded-[16px] border border-line bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <ProjectIconTile icon={content.projectIcon} as={FileText} size="base" />
        <h2 id="content-title" className="min-w-0 flex-1 basis-48 break-words pt-1.5 text-2xl leading-tight text-fg">
          {content.name}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {content.canEdit && (
            <Link href={content.editHref} className={buttonClass("outline", "min-h-9")}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit content
            </Link>
          )}
          <ContentMenu content={content} showOpen={false} showEdit={false} then="project" />
        </div>
      </div>

      <div className={content.briefLink ? "grid gap-4 md:grid-cols-[3fr_2fr]" : "grid gap-4"}>
        {content.description ? (
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-fg-muted">{content.description}</p>
        ) : (
          <p className="text-sm text-fg-muted">No description</p>
        )}
        {content.briefLink && (
          <div className="flex min-w-0 items-start gap-3 self-start rounded-[14px] bg-card-inset p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-brand-500">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg" title={content.briefLink}>
                {content.briefLabel}
              </p>
              <a
                href={content.briefLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 rounded text-xs text-fg-muted hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                Creative brief · View document
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </div>
        )}
      </div>

      <ContentProgress name={content.name} status={content.status} stats={content.stats} />

      <dl className="grid gap-4 border-t border-line-subtle pt-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line-subtle">
        <MetaItem icon={CalendarDays} label="Due date" value={content.dueDateLabel} />
        <MetaItem
          avatar={<Avatar name={content.createdBy.name} url={content.createdBy.avatarUrl} size={36} />}
          label="Created by"
          value={content.createdBy.name}
        />
        <MetaItem icon={Clock} label="Last Updated" value={content.updatedAtLabel} />
      </dl>
    </section>
  );
}

const ADD_TASK_ID = "add-task-trigger";

/**
 * Content detail Tasks section. Toolbar state lives in the URL (filters, already
 * applied server-side by loadContentDetail). "+ Add task" (when the viewer may
 * create at least one type) opens the Create Task drawer via ?newTask=1.
 * Summary line counts ALL tasks (cancelled included).
 */
export function TasksSection({ content, filters }) {
  const { stats } = content;
  const query = (next) => `${content.href}${taskFiltersQuery({ ...filters, newTask: false, editTask: "", ...next })}`;
  // Table header: Due date ↑ ⇄ ↓ (from Manual it starts with ↑).
  const sortHref = query({ sort: filters.sort === "due_asc" ? "due_desc" : "due_asc" });
  const canAdd = content.taskTypes.length > 0;
  const addHref = canAdd ? query({ newTask: true }) : null;
  const n = stats.all;
  // "Edit task" in each ⋯ opens the same drawer in edit mode (?editTask=<id>).
  // Clicking a card / table title opens the Task Detail panel (?task=<id>).
  const tasks = content.tasks.map((t) => ({
    ...t,
    openHref: query({ task: t.id }),
    ...(t.canEdit ? { editHref: query({ editTask: t.id }) } : {}),
  }));

  return (
    <section aria-labelledby="tasks-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="tasks-heading" className="text-xl text-fg">Tasks</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {n} {n === 1 ? "task" : "tasks"} · {stats.inProgress} in progress · {stats.open} open
          </p>
        </div>
        <ContentToolbar kind="tasks" basePath={content.href} filters={filters} addHref={addHref} addId={ADD_TASK_ID} />
      </div>

      {n === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[16px] bg-card-inset py-12 text-center">
          <ListChecks className="size-6 text-fg-muted" aria-hidden="true" />
          <p className="text-sm text-fg-muted">No tasks yet</p>
          {addHref && (
            <Link href={addHref} scroll={false} className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden="true" />
              Add task
            </Link>
          )}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[16px] bg-card-inset py-12 text-center">
          <p className="text-sm text-fg-muted">No tasks match these filters</p>
          <Link href={query({ q: "", status: "" })} scroll={false} replace className={buttonClass("secondary")}>
            Clear filters
          </Link>
        </div>
      ) : filters.view === "table" ? (
        // Same order as the cards (manual by default); not draggable.
        <TasksTable tasks={tasks} sort={filters.sort} sortHref={sortHref} />
      ) : (
        <SortableBoard
          kind="tasks"
          label="Tasks"
          projectId={content.projectId}
          contentId={content.id}
          items={tasks.map((t) => ({ id: t.id, node: <TaskCard task={t} withFooter /> }))}
          canReorder={!!content.canReorderTasks}
          blockedReason={
            content.reorderBlocked === "filters"
              ? "Clear filters to reorder"
              : content.reorderBlocked === "sort"
                ? "Switch to Manual order to reorder"
                : null
          }
        />
      )}

      {tasks.length > 0 && (
        <p className="text-sm text-fg-muted">
          {tasks.length === n ? `Showing all ${n} tasks` : `Showing ${tasks.length} of ${n} tasks`}
        </p>
      )}

      {(canAdd || content.drawer?.mode === "edit") && (
        <CreateTaskDrawer
          drawer={content.drawer}
          projectId={content.projectId}
          contentId={content.id}
          projectName={content.projectName}
          contentName={content.name}
          allowedTypes={content.taskTypes}
          returnFocusId={ADD_TASK_ID}
        />
      )}
    </section>
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
