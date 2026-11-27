"use client";

// Task Detail panel (Figma 172:368) — a wide slide-over opened by ?task=<id> on the
// project Content tab and the Content detail page. The task id lives ONLY in the
// URL; the host below reads it with useSearchParams and loads the data itself
// (round 35: no page re-render per open/close — see the host's comment).
//
// Read-only mode (`panel.readOnly`, round 34): a Related Asset opened from another
// project the viewer isn't a member of — no ⋯ menu / Edit / status dropdown,
// Project + Content as plain text, a "View only" note. The server decides
// (lib/projects/access.js taskReadAccess); the write actions re-check anyway.
//
// Left column: type + ID chips, title, description, the info rows that apply to
// the task's type. Right column: Status & Progress (stepper, current status with
// an inline change, Post asset status, progress) and the tabs — Activity · Work
// Plan · Reviews (round 46: Reviews for Clip / Graphic; round 47: Work Plan, every
// type — components/tasks/WorkPlanTab.jsx; round 53: the Comments tab was removed).
// Round 53 (lg+): the left card is its own scroll container (themed app-scrollbar
// inside its border); stacked below lg, the panel body scrolls as a whole.
// Clip (round 45, Figma 341:*): its own left column (ClipInfoColumn, with the
// Related Production card) and, under the 5-step stepper, the Current Status
// card with ONE primary action (lib/tasks/clipFlow.js clipPrimaryAction).
// Each column scrolls on its own (≥ lg); below that the body scrolls as one.

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  Camera,
  CalendarClock,
  CalendarDays,
  Check,
  CircleCheck,
  Clapperboard,
  Clock,
  Hourglass,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FolderKanban,
  FolderOpen,
  HardDrive,
  Hash,
  Images,
  Layers,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  Mic,
  MonitorSmartphone,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Send,
  Shapes,
  TriangleAlert,
  UserCheck,
  UserRound,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { changeTaskStatusAction, loadTaskActivityAction, loadTaskPanelAction } from "@/app/(app)/projects/task-actions";
import StatusMoveForm from "@/components/tasks/StatusMoveForm";
import ReviewDialog from "@/components/tasks/ReviewDialog";
import ReviewsTab from "@/components/tasks/ReviewsTab";
import WorkPlanTab from "@/components/tasks/WorkPlanTab";
import { CopyIconButton, CopyTextButton } from "@/components/ui/CopyButton";
import { sessionTimeLabel } from "@/lib/tasks/shootSessions";
import { formatThaiDay } from "@/lib/projects/format";
import TypeStatusCard, { ShootDialog } from "@/components/tasks/TypeStatusCard";
import Modal from "@/components/ui/Modal";
import {
  getCachedPanel,
  invalidateTaskPanel,
  panelCacheVersion,
  setCachedPanel,
  subscribePanelCache,
} from "@/components/tasks/panelCache";
import TaskOpenLink, { closeTaskPanel } from "@/components/tasks/TaskOpenLink";
import { createLatestGuard, taskPanelUrl, validTaskId } from "@/lib/tasks/panelUrl";
import { TaskMenu } from "@/components/projects/ProjectMenu";
import { StatusChip } from "@/components/projects/ProjectBits";
import AssetStatusChip from "@/components/tasks/AssetStatusChip";
import MsdbIcon from "@/components/tasks/MsdbIcon";
import PlatformIcon from "@/components/tasks/PlatformIcon";
import { AssetRow } from "@/components/tasks/RelatedAssetsCard";
import { RelatedBadge } from "@/components/tasks/RelatedPicker";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import Drawer, { useDrawerClose } from "@/components/ui/Drawer";
import { toast } from "@/components/ui/Toast";
import { getTaskType } from "@/lib/tasks/types";

const TITLE_ID = "task-detail-title";

/**
 * The panel host (one per page). Open state = `?task=` in the URL, read with
 * useSearchParams and nothing else (no local "isOpen"). Opening pushes the URL
 * (TaskOpenLink / openTaskPanel); every close (×, Escape, backdrop, after delete)
 * replaces it without `task` (closeTaskPanel); Back pops the push. Both use the
 * native History API, so the page itself is never re-rendered for the panel.
 *
 * Data: loadTaskPanelAction(id) on the client, keyed by id. Cached in memory
 * (panelCache.js): a cached task shows at once and refreshes in the background;
 * an uncached one shows the skeleton. Only the latest request may set state
 * (createLatestGuard), so a slow answer for a previous id is dropped. Writes call
 * invalidateTaskPanel() → the open panel refetches.
 */
export default function TaskDetailPanel() {
  const raw = useSearchParams().get("task");
  const open = raw != null;
  const taskId = validTaskId(raw);
  const version = useSyncExternalStore(subscribePanelCache, panelCacheVersion, () => 0);
  const [guard] = useState(createLatestGuard);
  const [result, setResult] = useState({ id: "", panel: null, error: false });

  // (Re)load on open, on a switch to another id, and after an invalidation
  // (`version`). The cached copy keeps showing meanwhile.
  useEffect(() => {
    if (!taskId) return;
    const token = guard.begin();
    loadTaskPanelAction(taskId)
      .then((res) => {
        if (!guard.isCurrent(token)) return; // stale: the panel moved on / closed
        if (!res?.ok) {
          setResult({ id: taskId, panel: null, error: true });
          return;
        }
        setCachedPanel(taskId, res.panel);
        setResult({ id: taskId, panel: res.panel, error: false });
      })
      .catch(() => {
        if (guard.isCurrent(token)) setResult({ id: taskId, panel: null, error: true });
      });
    return guard.cancel;
  }, [taskId, version, guard]);

  // What to show for the CURRENT id only: its latest answer, else its cached copy,
  // else the skeleton. A result for another id is never shown.
  const fresh = result.id === taskId && !result.error ? { panel: result.panel } : null;
  const shown = taskId ? (fresh ?? getCachedPanel(taskId)) : { panel: null };
  const panel = shown?.panel ?? null;
  let body;
  if (shown) body = panel ? <PanelBody key={panel.id} panel={panel} /> : <NotFound />;
  else if (result.id === taskId && result.error) body = <NotFound failed />;
  else body = <PanelSkeleton />;

  // Swapped to another task (a Related Asset row): the clicked row is gone, so
  // put focus back on the (stable) close button instead of losing it.
  const closeRef = useRef(null);
  useEffect(() => {
    if (taskId) closeRef.current?.focus({ preventScroll: true });
  }, [taskId]);

  return (
    <Drawer open={open} size="wide" closeOnBackdrop labelledBy={TITLE_ID} onClose={closeTaskPanel}>
      {/* The header stays mounted across skeleton → data → another task, so the
          close button (initial focus) never loses focus. */}
      <Header closeRef={closeRef}>{panel && <HeaderActions key={panel.id} panel={panel} />}</Header>
      {body}
    </Drawer>
  );
}

/** Instant placeholder while an uncached task loads: the two columns. */
function PanelSkeleton() {
  const bar = "animate-pulse rounded-full bg-track";
  return (
    <>
      <div
        aria-busy="true"
        aria-label="Loading task"
        className="min-h-0 flex-1 overflow-hidden bg-card-inset/40 p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-4"
      >
        <div className="flex flex-col gap-4 rounded-[16px] border border-line bg-card p-4 sm:p-5">
          <div className="flex gap-2">
            <span className={`h-6 w-20 ${bar}`} />
            <span className={`h-6 w-24 ${bar}`} />
          </div>
          <span className={`h-7 w-3/4 ${bar}`} />
          <span className={`h-4 w-full ${bar}`} />
          <span className={`h-4 w-2/3 ${bar}`} />
          <div className="mt-2 flex flex-col gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`h-5 w-full ${bar}`} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:mt-0">
          <div className="flex flex-col gap-4 rounded-[16px] border border-line bg-card p-4 sm:p-5">
            <span className={`h-6 w-40 ${bar}`} />
            <span className={`h-10 w-full ${bar}`} />
            <div className="grid gap-3 sm:grid-cols-2">
              <span className="h-20 animate-pulse rounded-[14px] bg-card-inset" />
              <span className="h-20 animate-pulse rounded-[14px] bg-card-inset" />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[16px] border border-line bg-card p-4 sm:p-5">
            <span className={`h-8 w-full ${bar}`} />
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-12 w-full ${bar}`} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Header({ closeRef, children }) {
  const close = useDrawerClose();
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
      <button
        ref={closeRef}
        type="button"
        onClick={close}
        aria-label="Close task detail"
        data-autofocus
        className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-line text-fg-muted transition-colors hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
      <h2 id={TITLE_ID} className="min-w-0 flex-1 truncate text-xl font-bold text-fg sm:text-2xl">
        Task Detail
      </h2>
      {children}
    </header>
  );
}

function NotFound({ failed = false }) {
  const close = useDrawerClose();
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <ListChecks className="size-8 text-fg-muted" aria-hidden="true" />
        <p className="text-lg font-semibold text-fg">{failed ? "Couldn't load this task" : "Task not found"}</p>
        <p className="max-w-sm text-sm text-fg-muted">
          {failed ? "Check your connection, then close and open it again." : "It may have been deleted, or you don't have access to its project."}
        </p>
        <button type="button" onClick={close} className={buttonClass("secondary")}>
          Close
        </button>
      </div>
    </>
  );
}

/** ⋯ menu + Edit Task (none when read-only). */
function HeaderActions({ panel }) {
  const close = useDrawerClose();
  // Round 48: ⋯ → "เลื่อนวันนัดถ่าย" (Production / Photo; same right as Change status).
  const [reschedule, setReschedule] = useState(false);
  const canReschedule = !!panel.statusView?.canReschedule && panel.canChangeStatus;
  return (
    <>
      {panel.menuTask && (
        <TaskMenu task={panel.menuTask} onDeleted={close} onReschedule={canReschedule ? () => setReschedule(true) : undefined} />
      )}
      {canReschedule && reschedule && <ShootDialog panel={panel} open onClose={() => setReschedule(false)} />}
      {panel.editHref && (
        <Link href={panel.editHref} scroll={false} className={buttonClass("primary", "min-h-10")}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit Task
        </Link>
      )}
    </>
  );
}

function PanelBody({ panel }) {
  return (
    <>
      {panel.readOnly && (
        // Opened as a Related Asset from a project the viewer belongs to.
        <p className="flex shrink-0 items-center gap-2 border-b border-line-subtle px-4 py-2 text-xs text-fg-muted sm:px-6">
          <Eye className="size-3.5 shrink-0" aria-hidden="true" />
          View only — you&apos;re not a member of this project.
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card-inset/40 p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-4 lg:overflow-hidden">
        {/* Round 53: the column is a plain full-height box; its CARD scrolls (INFO_CARD). */}
        <div className="relative min-h-0 lg:flex lg:flex-col">
          <InfoColumn panel={panel} />
        </div>
        <div className="app-scrollbar relative mt-3 min-h-0 lg:mt-0 lg:overflow-y-auto lg:overscroll-contain">
          <StatusColumn panel={panel} />
        </div>
      </div>
    </>
  );
}

// ── Left column ───────────────────────────────────────────────────────────

/** Round 57.1: the shared copy behaviour (components/ui/CopyButton.jsx). */
function CopyButton({ value, label }) {
  return <CopyIconButton value={value} label={label} />;
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-3 py-2.5 text-sm">
      <dt className="flex items-center gap-2.5 text-fg-muted">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </div>
  );
}

/** The real URL of another task's panel on this page (for new-tab clicks). Client only. */
const assetHref = (taskId) => (typeof window === "undefined" ? "#" : taskPanelUrl(window.location, taskId));

/** A link when there's an href; plain text otherwise (read-only viewers). */
function MaybeLink({ href, children }) {
  if (!href) return <span>{children}</span>;
  return (
    <Link href={href} className="rounded hover:text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
      {children}
    </Link>
  );
}

function PersonValue({ person }) {
  if (!person) return <span className="text-fg-muted">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={person.name} url={person.avatarUrl} size={24} />
      <span className="truncate">{person.name}</span>
    </span>
  );
}

/** Production people: accounts with avatars; external presenters with initials + "External". */
function PeopleList({ people, empty }) {
  if (!people.length) return <span className="text-fg-muted">{empty}</span>;
  return (
    <ul className="flex flex-col gap-1.5">
      {people.map((p, i) => (
        <li key={`${p.external ? "x" : "u"}:${p.id}:${i}`} className="flex min-w-0 items-center gap-2">
          {p.external ? (
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-track text-[10px] font-semibold text-fg-muted">
              {initials(p.name)}
            </span>
          ) : (
            <Avatar name={p.name} url={p.avatarUrl} size={24} />
          )}
          <span className="truncate">{p.name}</span>
          {p.external && <span className="shrink-0 rounded-full bg-track px-2 py-0.5 text-[10px] font-semibold text-fg-muted">External</span>}
        </li>
      ))}
    </ul>
  );
}

const initials = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

/** An http(s) link that opens in a new tab. */
function ExternalUrl({ href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 rounded break-all text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <span className="min-w-0">{href}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function Description({ text }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 220 || text.split("\n").length > 3;
  return (
    <div className="mt-2">
      <p className={`whitespace-pre-line break-words text-sm leading-relaxed text-fg-muted ${expanded ? "" : "line-clamp-3"}`}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 rounded text-xs font-semibold text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/** Type + ID chips, title, description (shared by every left column). */
function InfoHead({ panel }) {
  const TypeIcon = getTaskType(panel.type)?.icon ?? ListChecks;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-fg">
          <TypeIcon className="size-3.5" aria-hidden="true" />
          {panel.typeLabel}
        </span>
        <span className="inline-flex items-center rounded-full bg-track px-3 py-1 font-mono text-xs font-semibold text-fg-muted">
          {panel.idChip}
        </span>
      </div>
      <h3 className="mt-3 break-words text-2xl font-bold leading-tight text-fg">{panel.title}</h3>
      {panel.description && <Description text={panel.description} />}
    </>
  );
}

/** The Related item (course / program / skill). MSDB has no public page URL yet, so no open icon. */
function RelatedBlock({ related }) {
  return (
    <div className="mt-2 border-t border-line-subtle pt-4">
      <p className="flex items-center gap-2.5 text-sm font-semibold text-fg">
        <Link2 className="size-4 text-fg-muted" aria-hidden="true" />
        Related
      </p>
      <div className="mt-2 flex min-w-0 items-center gap-2 rounded-[12px] bg-card-inset px-3 py-2">
        <MsdbIcon url={related.iconUrl} code={related.code} name={related.name} />
        <RelatedBadge kind={related.kind} isInhouse={related.isInhouse} />
        <span className="min-w-0 truncate text-sm text-fg">{related.name}</span>
      </div>
    </div>
  );
}

/**
 * The left card (every type). lg+: it fills the column and scrolls INSIDE its
 * border with the themed thin scrollbar; the track is inset top/bottom so the
 * thumb never pokes into the rounded corners. Below lg it is a normal card.
 */
const INFO_CARD =
  "rounded-[16px] border border-line bg-card p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-3 app-scrollbar [&::-webkit-scrollbar-track]:my-3";

function InfoColumn({ panel }) {
  if (panel.clip) return <ClipInfoColumn panel={panel} />;
  return (
    <section aria-label="Task information" className={INFO_CARD}>
      <InfoHead panel={panel} />

      <dl className="mt-4 divide-y divide-line-subtle border-t border-line-subtle">
        <Row icon={FolderKanban} label="Project">
          <MaybeLink href={panel.project.href}>{panel.project.name}</MaybeLink>
        </Row>
        <Row icon={FileText} label="Content">
          <MaybeLink href={panel.content.href}>{panel.content.name}</MaybeLink>
        </Row>
        {panel.platform && (
          <Row icon={MonitorSmartphone} label="Platform">
            <span className="flex items-center gap-2">
              <PlatformIcon icon={panel.platform.icon} />
              {panel.platform.label}
            </span>
          </Row>
        )}
        {panel.platforms.length > 0 && (
          <Row icon={MonitorSmartphone} label="Platforms">
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {panel.platforms.map((p, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <PlatformIcon icon={p.icon} size={16} />
                  {p.label}
                </span>
              ))}
            </span>
          </Row>
        )}
        {panel.workType && (
          <Row icon={Shapes} label={panel.workType.title}>
            {panel.workType.label}
          </Row>
        )}
        {panel.items != null && (
          <Row icon={Hash} label="Items">
            {panel.items}
          </Row>
        )}
        {panel.videoType && (
          <Row icon={PlayCircle} label="Video Type">
            {panel.videoType}
          </Row>
        )}
        {panel.articleType && (
          <Row icon={FileText} label="Article Type">
            {panel.articleType}
          </Row>
        )}
        {panel.photoType && (
          <Row icon={Camera} label="Photo Type">
            {panel.photoType}
          </Row>
        )}
      </dl>

      {panel.related && <RelatedBlock related={panel.related} />}

      {panel.relatedAssets && (
        <div className="mt-4 border-t border-line-subtle pt-4">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-fg">
            <Images className="size-4 text-fg-muted" aria-hidden="true" />
            Related Assets ({panel.relatedAssets.length})
          </p>
          {panel.relatedAssets.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">No assets linked.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {panel.relatedAssets.map((a) => (
                <li key={a.id}>
                  {/* Swaps this panel to the asset in place (replace: Back still closes). */}
                  <TaskOpenLink
                    taskId={a.id}
                    href={assetHref(a.id)}
                    replace
                    className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2 transition-colors hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-brand-500"
                    aria-label={`Open ${a.typeLabel}: ${a.title}`}
                  >
                    <AssetRow a={a} />
                    <ExternalLink className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                  </TaskOpenLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <dl className="mt-4 divide-y divide-line-subtle border-t border-line-subtle">
        {panel.videographers ? (
          // Production (round 38): the first Videographer is the task's assignee.
          <>
            <Row icon={Video} label={panel.videographers.length === 1 ? "Videographer" : "Videographers"}>
              <PeopleList people={panel.videographers} empty="Unassigned" />
            </Row>
            <Row icon={Mic} label={panel.presenters.length === 1 ? "Presenter" : "Presenters"}>
              <PeopleList people={panel.presenters} empty="None" />
            </Row>
          </>
        ) : (
          <Row icon={UserRound} label={panel.assignee.title}>
            <PersonValue person={panel.assignee.person} />
          </Row>
        )}
        {panel.scriptUrl && (
          <Row icon={Link2} label="Script Reference">
            <ExternalUrl href={panel.scriptUrl} />
          </Row>
        )}
        {panel.recordUrl && (
          <Row icon={Link2} label="File Record">
            <ExternalUrl href={panel.recordUrl} />
          </Row>
        )}
        {panel.reviewers.map((r) => (
          <Row key={r.title} icon={UserCheck} label={r.title}>
            <PersonValue person={r.person} />
          </Row>
        ))}
        {panel.workLevelLabel && (
          <Row icon={BarChart3} label="Work Level">
            {panel.workLevelLabel}
          </Row>
        )}
        {panel.start.label && (
          <Row icon={CalendarDays} label={panel.start.title}>
            {panel.start.label}
          </Row>
        )}
        {panel.due.label && (
          <Row icon={CalendarClock} label={panel.due.title}>
            {panel.due.label}
          </Row>
        )}
        {panel.type === "production" && (
          // Round 57.1: one line per นัดถ่าย session — date · time range · location.
          <Row icon={Camera} label="นัดถ่าย">
            {panel.shootSessions.length ? (
              <ul className="flex flex-col gap-1">
                {panel.shootSessions.map((x) => (
                  <li key={x._id}>
                    <span className="font-medium">{formatThaiDay(x.date, { weekday: false })}</span>
                    <span className="text-fg-muted"> · </span>
                    {sessionTimeLabel(x)}
                    {x.location && (
                      <>
                        <span className="text-fg-muted"> · </span>
                        {x.location}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-fg-muted">ยังไม่ได้นัดถ่าย</span>
            )}
          </Row>
        )}
        {panel.folderId && (
          <Row icon={FolderOpen} label="Folder ID">
            <span className="flex items-center gap-1">
              <span className="font-mono font-semibold">{panel.folderId}</span>
              <CopyButton value={panel.folderId} label="Folder ID" />
            </span>
          </Row>
        )}
        {panel.folderName && (
          <Row icon={FolderOpen} label="Folder Name">
            <span className="flex items-start gap-1">
              <span className="min-w-0 break-words">{panel.folderName}</span>
              <CopyButton value={panel.folderName} label="folder name" />
            </span>
          </Row>
        )}
        {panel.folderLocation && (
          <Row icon={HardDrive} label="Folder Location">
            <span className="flex items-start gap-1">
              <span className="min-w-0 break-all font-mono text-xs">{panel.folderLocation}</span>
              <CopyButton value={panel.folderLocation} label="folder location" />
            </span>
          </Row>
        )}
        {panel.fileLocation && (
          <Row icon={HardDrive} label="File Location">
            <span className="flex items-start gap-1">
              <span className="min-w-0 break-all font-mono text-xs">{panel.fileLocation}</span>
              <CopyButton value={panel.fileLocation} label="file location" />
            </span>
          </Row>
        )}
        <Row icon={Clock} label="Created">
          {panel.created.atLabel}
          {panel.created.by && <span className="text-fg-muted"> by {panel.created.by}</span>}
        </Row>
        <Row icon={RefreshCw} label="Last Updated">
          {panel.updated.atLabel}
          {panel.updated.by && <span className="text-fg-muted"> by {panel.updated.by}</span>}
        </Row>
      </dl>
    </section>
  );
}

/** Platforms: the first one (brand icon + name), the rest as "+N". */
function PlatformsValue({ platforms }) {
  const [first, ...rest] = platforms;
  const others = rest.map((p) => p.label).join(", ");
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PlatformIcon icon={first.icon} />
      <span className="truncate">{first.label}</span>
      {rest.length > 0 && (
        <span title={others} className="shrink-0 rounded-full bg-track px-2 py-0.5 text-xs font-semibold text-fg-muted">
          +{rest.length}
          <span className="sr-only"> more: {others}</span>
        </span>
      )}
    </span>
  );
}

/** One Related Production row: tile · title · status, Due, first videographer +N. */
function ProductionRow({ rp }) {
  return (
    <>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-card-inset text-fg-muted">
        <Clapperboard className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{rp.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          <StatusChip status={rp.group} label={rp.statusLabel} />
          {rp.dueLabel && (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Due {rp.dueLabel}
            </span>
          )}
          {rp.videographer && (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar name={rp.videographer.name} url={rp.videographer.avatarUrl} size={20} />
              <span className="truncate">{rp.videographer.name}</span>
              {rp.extraVideographers > 0 && <span className="font-semibold">+{rp.extraVideographers}</span>}
            </span>
          )}
        </span>
      </span>
    </>
  );
}

/** Clip: the linked Production (live), or "ไม่ได้เชื่อม Production" + "เชื่อม" for editors. */
function RelatedProductionBlock({ clip }) {
  const rp = clip.relatedProduction;
  const box = "mt-2 flex items-center gap-3 rounded-[12px] border border-line px-3 py-2";
  return (
    <div className="mt-4 border-t border-line-subtle pt-4">
      <p className="flex items-center gap-2.5 text-sm font-semibold text-fg">
        <Clapperboard className="size-4 text-fg-muted" aria-hidden="true" />
        Related Production
      </p>
      {!rp ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-[12px] border border-dashed border-line px-3 py-2.5 text-sm">
          <span className="text-fg-muted">ไม่ได้เชื่อม Production</span>
          {clip.linkProductionHref && (
            <Link
              href={clip.linkProductionHref}
              scroll={false}
              className="shrink-0 rounded font-semibold text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              เชื่อม
            </Link>
          )}
        </div>
      ) : rp.canOpen ? (
        // Swaps this panel to the Production in place (replace: Back still closes).
        <TaskOpenLink
          taskId={rp.id}
          href={assetHref(rp.id)}
          replace
          className={`${box} transition-colors hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-brand-500`}
          aria-label={`Open Production: ${rp.title}`}
        >
          <ProductionRow rp={rp} />
          <ExternalLink className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
        </TaskOpenLink>
      ) : (
        <div className={box}>
          <ProductionRow rp={rp} />
        </div>
      )}
    </div>
  );
}

const dash = <span className="text-fg-muted">—</span>;

/** Clip left column (Figma 341:*, round 45). */
function ClipInfoColumn({ panel }) {
  const { clip } = panel;
  return (
    <section aria-label="Task information" className={INFO_CARD}>
      <InfoHead panel={panel} />

      <dl className="mt-4 divide-y divide-line-subtle border-t border-line-subtle">
        <Row icon={FolderKanban} label="Project">
          <MaybeLink href={panel.project.href}>{panel.project.name}</MaybeLink>
        </Row>
        <Row icon={FileText} label="Content">
          <MaybeLink href={panel.content.href}>{panel.content.name}</MaybeLink>
        </Row>
        <Row icon={MonitorSmartphone} label="Platform">
          {panel.platforms.length ? <PlatformsValue platforms={panel.platforms} /> : dash}
        </Row>
        <Row icon={PlayCircle} label="Video Type">
          {panel.videoType ?? dash}
        </Row>
      </dl>

      {panel.related && <RelatedBlock related={panel.related} />}
      <RelatedProductionBlock clip={clip} />

      <dl className="mt-4 divide-y divide-line-subtle border-t border-line-subtle">
        <Row icon={UserRound} label="Assignee">
          <PersonValue person={panel.assignee.person} />
        </Row>
        {panel.reviewers.map((r) => (
          <Row key={r.title} icon={UserCheck} label={r.title}>
            <PersonValue person={r.person} />
          </Row>
        ))}
        <Row icon={BarChart3} label="Work Level">
          {panel.workLevelLabel ?? dash}
        </Row>
        <Row icon={CalendarDays} label="Start">
          {panel.start.label ?? dash}
        </Row>
        <Row icon={CalendarClock} label="Due">
          {panel.due.label ?? dash}
        </Row>
        <Row icon={Clock} label="Created">
          {panel.created.atLabel}
          {panel.created.by && <span className="text-fg-muted"> · by {panel.created.by}</span>}
        </Row>
        <Row icon={RefreshCw} label="Last Updated">
          {panel.updated.atLabel}
          {panel.updated.by && <span className="text-fg-muted"> · by {panel.updated.by}</span>}
        </Row>
      </dl>
    </section>
  );
}

// ── Right column ──────────────────────────────────────────────────────────

// Step circle per state: border + text, and the FILL drawn as an inner layer
// (STEP_FILL) over the circle's opaque bg-card base — round 50.1: a translucent
// tint (warning) must never let anything behind it show through.
const STEP_DOT = {
  complete: "border-success text-white",
  current: "border-brand-500 text-navy ring-4 ring-brand-500/20",
  // Round 45: Clip แก้ไข sits on "ตรวจงาน" with a warning (frame 341:2231).
  warning: "border-warning text-warning ring-4 ring-warning/15",
  // Round 49: Article / Post รอชิ้นงาน before it is reached — "(ถ้ามี)".
  optional: "border-dashed border-line text-fg-muted",
  upcoming: "border-line text-fg-muted",
  muted: "border-line text-fg-muted",
};
const STEP_FILL = {
  complete: "bg-success",
  current: "bg-brand-500",
  warning: "bg-warning/15",
  muted: "bg-track",
};
const STEP_LABEL = {
  complete: "text-fg",
  current: "rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent-fg",
  warning: "font-semibold text-warning",
  optional: "text-fg-muted",
  upcoming: "text-fg-muted",
  muted: "text-fg-muted",
};
const STEP_SR = { complete: " (done)", current: " (current)", warning: " (current, needs changes)" };

function Stepper({ stepper }) {
  return (
    <div className={stepper.terminal ? "opacity-60" : ""}>
      {/* Round 58.2: overflow-x:auto makes overflow-y auto too, so this list clips at
          its padding edge. The current step's ring-4 halo (a 4px box-shadow) needs room
          on EVERY side: p-1.5 (6px) gives it that, and the matching -m-1.5 keeps the
          circles exactly where they were. pb-2.5 keeps the old scrollbar gap. */}
      <ol className="-m-1.5 flex overflow-x-auto p-1.5 pb-2.5" aria-label="Status steps">
        {stepper.steps.map((s, i) => (
          <li key={s.key} className="relative flex min-w-[5.5rem] flex-1 flex-col items-center gap-2 text-center">
            {i > 0 && (
              // Round 50.1: a SEGMENT from the previous circle's edge to this one's
              // (radius 1rem + the 0.25rem halo), never behind a circle.
              <span
                aria-hidden="true"
                className={`absolute left-[calc(-50%+1.25rem)] right-[calc(50%+1.25rem)] top-4 z-0 h-0.5 -translate-y-1/2 ${s.state === "complete" || s.state === "current" || s.state === "warning" ? "bg-success" : "bg-line"}`}
              />
            )}
            <span className={`relative z-[1] flex size-8 items-center justify-center rounded-full border-2 bg-card text-xs font-bold ${STEP_DOT[s.state]}`}>
              {STEP_FILL[s.state] && <span aria-hidden="true" className={`absolute inset-0 rounded-full ${STEP_FILL[s.state]}`} />}
              <span className="relative">
                {s.state === "complete" ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : s.state === "warning" ? (
                  <TriangleAlert className="size-4" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
            </span>
            <span className={`text-xs ${STEP_LABEL[s.state]}`}>
              {s.label}
              <span className="sr-only">{STEP_SR[s.state] ?? ""}</span>
              {s.note && <span className={`block text-[11px] font-medium ${s.noteTone === "success" ? "text-success" : ""}`}>{s.note}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Current status + "Change status" (round 40): the SAME form as the task ⋯ menu
 * (components/tasks/StatusMoveForm.jsx), offering only the allowed moves. Used by
 * the types without their own status card (Post, Article). Round 48: Graphic
 * moved to TypeStatusCard, so the round-46 review button under it is gone.
 */
function StatusTile({ panel }) {
  const [open, setOpen] = useState(false);
  const task = panel.menuTask;
  const canChange = panel.canChangeStatus && !!task && (task.statusMoves?.length ?? 0) > 0;
  return (
    <div className="rounded-[14px] bg-card-inset p-3.5">
      <p className="text-xs text-fg-muted">Current Status</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <StatusChip status={panel.group} label={panel.statusLabel} />
        {canChange && (
          <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
            <ArrowRightLeft className="size-4" aria-hidden="true" />
            Change status
          </button>
        )}
      </div>
      {canChange && (
        <Modal open={open} onClose={() => setOpen(false)} title="Change status" description={`${panel.idChip} · ${panel.title}`} size="md">
          <StatusMoveForm task={task} onDone={() => setOpen(false)} onSaved={() => toast("Status updated")} />
        </Modal>
      )}
    </div>
  );
}

function StatusColumn({ panel }) {
  const { stepper } = panel;
  const showAsset = !!panel.assetStatusLabel;
  // Tabs are controlled here: "Review <Section>" switches to Reviews and focuses that card.
  // Round 58: ?taskTab=work_plan (My Workspace Work Plan card) starts on Work Plan.
  const startTab = useSearchParams().get("taskTab");
  const [tab, setTab] = useState(() => (startTab === "work_plan" && panel.workPlan ? "work_plan" : "activity"));
  const [focus, setFocus] = useState(null);
  const onReview = (key) => {
    setTab("reviews");
    setFocus({ key, n: Date.now() });
  };
  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="task-status-heading" className="rounded-[16px] border border-line bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="task-status-heading" className="text-lg font-bold text-fg">Status &amp; Progress</h3>
          {panel.updatedRelative && <p className="text-xs text-fg-muted">Updated {panel.updatedRelative}</p>}
        </div>
        {stepper.terminal && (
          <p
            role="status"
            className={`mt-3 rounded-[10px] px-3 py-2 text-sm font-semibold ${
              stepper.terminal.kind === "cancelled" ? "bg-danger/10 text-danger" : "bg-warning/15 text-warning"
            }`}
          >
            {stepper.terminal.banner} · {stepper.terminal.label}
          </p>
        )}
        <div className="mt-4">
          <Stepper stepper={stepper} />
        </div>
        {panel.clip ? (
          <ClipStatusCard panel={panel} onReview={onReview} />
        ) : panel.statusView ? (
          <TypeStatusCard panel={panel} onReview={onReview} />
        ) : (
          <div className={`mt-4 grid gap-3 ${showAsset ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <StatusTile panel={panel} />
            {showAsset && (
              <div className="rounded-[14px] bg-card-inset p-3.5">
                <p className="text-xs text-fg-muted">Asset Status</p>
                <p className="mt-2">
                  <AssetStatusChip status={panel.assetStatus} label={panel.assetStatusLabel} />
                </p>
              </div>
            )}
            <div className="rounded-[14px] bg-card-inset p-3.5">
              <p className="text-xs text-fg-muted">Progress</p>
              {stepper.percent == null ? (
                <p className="mt-1.5 text-xl font-bold text-fg-muted">—</p>
              ) : (
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="text-xl font-bold text-fg">{stepper.percent}%</span>
                  <span
                    role="progressbar"
                    aria-label="Task progress"
                    aria-valuenow={stepper.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 flex-1 overflow-hidden rounded-full bg-track"
                  >
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${stepper.percent}%` }} />
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section aria-label="Task tabs" className="rounded-[16px] border border-line bg-card p-4 sm:p-5">
        <TaskTabs panel={panel} tab={tab} setTab={setTab} focus={focus} />
      </section>
    </div>
  );
}

// ── Clip: Current Status + primary action (rounds 45–46) ───────────────────

const STATUS_ICON = {
  waiting_review: { Icon: Eye, tone: "bg-brand-500/15 text-accent-fg" },
  revising: { Icon: TriangleAlert, tone: "bg-warning/15 text-warning" },
  done: { Icon: CircleCheck, tone: "bg-success/15 text-success" },
  paused: { Icon: PauseCircle, tone: "bg-warning/15 text-warning" },
  cancelled: { Icon: XCircle, tone: "bg-danger/10 text-danger" },
};
const DEFAULT_STATUS_ICON = { Icon: Hourglass, tone: "bg-accent-soft text-accent-fg" };
// Review states read "<English> · <Thai>" (Figma 341:1293 / 341:2231 / 341:2913).
const REVIEW_TITLE = {
  waiting_review: ["In Review", null],
  revising: ["Revision Required", "ต้องแก้ไข"],
  done: ["Completed", null],
};

/** "ตั้งแต่ <when> · โดย <who>", or "อัตโนมัติจาก Production "…" · <when>" (latest status change). */
function statusContextLine(c) {
  if (!c) return "";
  if (c.autoFrom != null) return `อัตโนมัติจาก Production "${c.autoFrom}" · ${c.atLabel}`;
  return `ตั้งแต่ ${c.atLabel}${c.by ? ` · โดย ${c.by}` : ""}`;
}

/** Round 46: the review cycle's line for รอตรวจ / แก้ไข / เสร็จสมบูรณ์, else null. */
function reviewContextLine(panel) {
  const cur = panel.review?.current;
  if (!cur) return null;
  if (panel.status === "waiting_review" && cur.status === "open") return `ส่งตรวจ ${cur.submittedAtLabel}`;
  if (panel.status === "revising" && cur.status === "revision") return `ผลตรวจ ${cur.closedAtLabel}`;
  if (panel.status === "done" && cur.status === "passed") return `ผ่านครบ ${cur.total} ส่วน · ${cur.closedAtLabel} · อัตโนมัติ`;
  return null;
}

/**
 * The ONE primary button: a plain status move (changeTaskStatusAction →
 * canTransition), Submit / Resubmit (the review dialog), Review <Section>
 * (switches to the Reviews tab) or Copy File Location.
 */
function PrimaryActionButton({ panel, button, onReview }) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState(false);
  if (button.kind === "copy") {
    return <CopyTextButton value={button.value} label={button.label} disabled={!!button.disabled} className={buttonClass("outline", "w-full")} />;
  }
  if (button.kind === "review") {
    return (
      <button type="button" onClick={() => onReview?.(button.section)} className={buttonClass("primary", "w-full")}>
        <Eye className="size-4" aria-hidden="true" />
        {button.label}
      </button>
    );
  }
  if (button.kind === "submit" || button.kind === "resubmit") {
    return (
      <>
        <button type="button" onClick={() => setDialog(true)} className={buttonClass("primary", "w-full")}>
          <Send className="size-4" aria-hidden="true" />
          {button.label}
        </button>
        <ReviewDialog
          task={{ id: panel.id, projectId: panel.projectId, contentId: panel.contentId }}
          open={dialog}
          onClose={() => setDialog(false)}
          mode={button.kind}
        />
      </>
    );
  }
  const move = () => {
    const fd = new FormData();
    fd.set("projectId", panel.projectId);
    fd.set("contentId", panel.contentId);
    fd.set("taskId", panel.id);
    fd.set("status", button.to);
    startTransition(async () => {
      const res = await changeTaskStatusAction(fd);
      if (res?.ok) {
        invalidateTaskPanel(); // the open panel refetches
        toast("Status updated");
      } else toast(res?.error ?? "Something went wrong.", { tone: "error" });
    });
  };
  return (
    <button type="button" onClick={move} disabled={pending} className={buttonClass("primary", "w-full")}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {button.label}
    </button>
  );
}

function ClipStatusCard({ panel, onReview }) {
  const { clip } = panel;
  const action = clip.primaryAction;
  const { Icon, tone } = STATUS_ICON[panel.status] ?? DEFAULT_STATUS_ICON;
  const isCopy = action?.button?.kind === "copy";
  const title = REVIEW_TITLE[panel.status];
  return (
    <div className={`mt-4 grid gap-3 ${action ? "sm:grid-cols-2" : ""}`}>
      <div className="flex gap-3 rounded-[14px] bg-card-inset p-3.5">
        <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-fg-muted">
            Current Status
            <Lock className="size-3" aria-hidden="true" />
            <span className="sr-only">(changes through the actions)</span>
          </p>
          <p className="mt-0.5 text-lg font-bold leading-snug text-fg">
            {title ? (
              <>
                {title[0]} <span className="text-sm font-normal text-fg-muted">· {title[1] ?? panel.statusLabel}</span>
              </>
            ) : (
              panel.statusLabel
            )}
          </p>
          <p className="mt-0.5 break-words text-xs text-fg-muted">{reviewContextLine(panel) ?? statusContextLine(clip.statusContext)}</p>
        </div>
      </div>
      {action && (
        <div className="flex min-w-0 flex-col justify-center gap-2 rounded-[14px] border border-line p-3.5">
          {action.button && <PrimaryActionButton panel={panel} button={action.button} onReview={onReview} />}
          <p title={isCopy ? action.helper : undefined} className={`text-xs text-fg-muted ${isCopy ? "truncate" : ""}`}>
            {action.helper}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tabs (Activity · Work Plan · Reviews, the same for every type) ──────────

function TaskTabs({ panel, tab, setTab, focus }) {
  // Reviews (N): sections waiting on THIS viewer (hidden at 0).
  const reviewCount = panel.review?.mine.length ?? 0;
  const tabs = [
    { key: "activity", label: "Activity" },
    // Round 57.1: no Work Plan for Photo (panel.workPlan is null).
    ...(panel.workPlan ? [{ key: "work_plan", label: "Work Plan" }] : []),
    { key: "reviews", label: reviewCount ? `Reviews (${reviewCount})` : "Reviews" },
  ];
  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.key === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    setTab(t.key);
    document.getElementById(`task-tab-${t.key}`)?.focus();
  };
  return (
    <>
      {/* Round 53: the baseline is an inset shadow (not a border the tabs overlap with
          -mb-px — that 1px made the overflow-x-auto list scroll vertically, with a
          tiny scrollbar). overflow-y-hidden; a horizontal overflow scrolls bar-less. */}
      <div
        role="tablist"
        aria-label="Task sections"
        onKeyDown={onKeyDown}
        className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 shadow-[inset_0_-1px_0_var(--ds-line)]"
      >
        {tabs.map((t) => {
          const selected = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`task-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`task-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`min-h-10 shrink-0 border-b-2 px-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
                selected ? "border-brand-500 font-semibold text-accent-fg" : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div id={`task-panel-${tab}`} role="tabpanel" aria-labelledby={`task-tab-${tab}`} className="pt-4">
        {tab === "activity" ? (
          <ActivityTimeline key={`${panel.id}:${panel.activity.entries[0]?.id ?? "none"}`} taskId={panel.id} initial={panel.activity} />
        ) : tab === "work_plan" && panel.workPlan ? (
          <WorkPlanTab key={panel.id} panel={panel} />
        ) : tab === "reviews" && panel.review ? (
          <ReviewsTab panel={panel} focus={focus} />
        ) : (
          <p className="rounded-[12px] bg-card-inset py-10 text-center text-sm text-fg-muted">
            {tab === "reviews" ? "งานประเภทนี้ไม่มีการตรวจ" : "เร็ว ๆ นี้"}
          </p>
        )}
      </div>
    </>
  );
}

// ── Activity ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: "all", label: "All Activities" },
  { key: "status", label: "Status" },
  { key: "edits", label: "Edits" },
  { key: "people", label: "People" },
  { key: "assets", label: "Assets" },
  { key: "reviews", label: "Reviews" },
  { key: "workplan", label: "Work Plan" },
];
const KIND = {
  created: { Icon: Plus, tone: "bg-track text-fg" },
  status_changed: { Icon: ArrowRightLeft, tone: "bg-success/15 text-success" },
  updated: { Icon: Pencil, tone: "bg-accent-soft text-accent-fg" },
  assignee_changed: { Icon: UserRound, tone: "bg-info/10 text-info" },
  reviewer_changed: { Icon: UserCheck, tone: "bg-info/10 text-info" },
  assets_changed: { Icon: Layers, tone: "bg-warning/15 text-warning" },
  review_submitted: { Icon: Send, tone: "bg-brand-500/15 text-accent-fg" },
  review_verdict: { Icon: Eye, tone: "bg-info/10 text-info" },
  review_withdrawn: { Icon: XCircle, tone: "bg-track text-fg-muted" },
  work_plan: { Icon: CalendarDays, tone: "bg-plan-soft text-plan-fg" },
};

function ActivityTimeline({ taskId, initial }) {
  const [filter, setFilter] = useState("all");
  const [list, setList] = useState({ entries: initial.entries, nextCursor: initial.nextCursor });
  const [pending, startTransition] = useTransition();

  const load = (nextFilter, cursor) =>
    startTransition(async () => {
      const res = await loadTaskActivityAction(taskId, nextFilter, cursor);
      if (!res?.ok) {
        toast(res?.error ?? "Couldn't load the activity.", { tone: "error" });
        return;
      }
      setList((cur) => ({
        entries: cursor ? [...cur.entries, ...res.entries] : res.entries,
        nextCursor: res.nextCursor,
      }));
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-bold text-fg">Activity Timeline</h4>
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <select
            aria-label="Filter activity"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              load(e.target.value, null);
            }}
            className="min-h-9 appearance-none rounded-[10px] border border-line bg-card py-1.5 pl-8 pr-8 text-sm text-fg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">{pending ? "Loading activity…" : ""}</p>
      {list.entries.length === 0 ? (
        <p className="mt-6 rounded-[12px] bg-card-inset py-8 text-center text-sm text-fg-muted">
          {pending ? "Loading…" : filter === "all" ? "No activity recorded yet." : "No activity of this kind."}
        </p>
      ) : (
        <ol className={`mt-4 flex flex-col ${pending ? "opacity-60" : ""}`}>
          {list.entries.map((e, i) => {
            const k = KIND[e.type] ?? KIND.updated;
            return (
              <li key={e.id} className="relative flex gap-3 pb-4">
                {i < list.entries.length - 1 && <span aria-hidden="true" className="absolute left-[1.1rem] top-10 h-[calc(100%-2.5rem)] w-px bg-line" />}
                <span className={`relative flex size-9 shrink-0 items-center justify-center rounded-full ${k.tone}`}>
                  <k.Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1 border-b border-line-subtle pb-3 sm:flex-row sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg">{e.title}</p>
                    {e.description && <p className="break-words text-sm text-fg-muted">{e.description}</p>}
                  </div>
                  <p className="shrink-0 text-xs text-fg-muted sm:text-right">
                    <time dateTime={e.at}>{e.atLabel}</time>
                    <br />
                    by {e.actorName}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {list.nextCursor && (
        <div className="flex justify-center">
          <button type="button" onClick={() => load(filter, list.nextCursor)} disabled={pending} className={buttonClass("secondary", "min-h-9")}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
