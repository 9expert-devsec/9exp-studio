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
// an inline change, Post asset status, progress) and the tabs — Activity is live;
// Comments / Reviews / Files / Related Tasks are "Coming soon".
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
  Clock,
  Copy,
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
  Mic,
  MonitorSmartphone,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Shapes,
  UserCheck,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { loadTaskActivityAction, loadTaskPanelAction } from "@/app/(app)/projects/task-actions";
import StatusMoveForm from "@/components/tasks/StatusMoveForm";
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
  return (
    <>
      {panel.menuTask && <TaskMenu task={panel.menuTask} onDeleted={close} />}
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card-inset/40 p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-4 lg:overflow-hidden">
        <div className="relative min-h-0 lg:overflow-y-auto lg:overscroll-contain">
          <InfoColumn panel={panel} />
        </div>
        <div className="relative mt-3 min-h-0 lg:mt-0 lg:overflow-y-auto lg:overscroll-contain">
          <StatusColumn panel={panel} />
        </div>
      </div>
    </>
  );
}

// ── Left column ───────────────────────────────────────────────────────────

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the value is still selectable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  );
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

function InfoColumn({ panel }) {
  const TypeIcon = getTaskType(panel.type)?.icon ?? ListChecks;
  return (
    <section aria-label="Task information" className="rounded-[16px] border border-line bg-card p-4 sm:p-5">
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

      {panel.related && (
        <div className="mt-2 border-t border-line-subtle pt-4">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-fg">
            <Link2 className="size-4 text-fg-muted" aria-hidden="true" />
            Related
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-2 rounded-[12px] bg-card-inset px-3 py-2">
            <MsdbIcon url={panel.related.iconUrl} code={panel.related.code} name={panel.related.name} />
            <RelatedBadge kind={panel.related.kind} isInhouse={panel.related.isInhouse} />
            <span className="min-w-0 truncate text-sm text-fg">{panel.related.name}</span>
          </div>
        </div>
      )}

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

// ── Right column ──────────────────────────────────────────────────────────

const STEP_DOT = {
  complete: "border-success bg-success text-white",
  current: "border-brand-500 bg-brand-500 text-navy ring-4 ring-brand-500/20",
  upcoming: "border-line bg-card text-fg-muted",
  muted: "border-line bg-track text-fg-muted",
};
const STEP_LABEL = {
  complete: "text-fg",
  current: "rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent-fg",
  upcoming: "text-fg-muted",
  muted: "text-fg-muted",
};

function Stepper({ stepper }) {
  return (
    <div className={stepper.terminal ? "opacity-60" : ""}>
      <ol className="flex overflow-x-auto pb-1" aria-label="Status steps">
        {stepper.steps.map((s, i) => (
          <li key={s.key} className="relative flex min-w-[5.5rem] flex-1 flex-col items-center gap-2 text-center">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${s.state === "complete" || s.state === "current" ? "bg-success" : "bg-line"}`}
              />
            )}
            <span className={`relative z-[1] flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold ${STEP_DOT[s.state]}`}>
              {s.state === "complete" ? <Check className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={`text-xs ${STEP_LABEL[s.state]}`}>
              {s.label}
              <span className="sr-only">
                {s.state === "complete" ? " (done)" : s.state === "current" ? " (current)" : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Current status + "Change status" (round 40): the SAME form as the task ⋯ menu
 * (components/tasks/StatusMoveForm.jsx), offering only the allowed moves.
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
        <Modal open={open} onClose={() => setOpen(false)} title="Change status" description={`${panel.idChip} · ${panel.title}`}>
          <StatusMoveForm task={task} onDone={() => setOpen(false)} onSaved={() => toast("Status updated")} />
        </Modal>
      )}
    </div>
  );
}

function StatusColumn({ panel }) {
  const { stepper } = panel;
  const showAsset = !!panel.assetStatusLabel;
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
      </section>

      <section aria-label="Task tabs" className="rounded-[16px] border border-line bg-card p-4 sm:p-5">
        <div role="tablist" aria-label="Task sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
          <button
            type="button"
            role="tab"
            aria-selected="true"
            id="task-tab-activity"
            aria-controls="task-panel-activity"
            className="-mb-px min-h-10 shrink-0 border-b-2 border-brand-500 px-3 text-sm font-semibold text-accent-fg"
          >
            Activity
          </button>
          {["Comments", "Reviews", "Files", "Related Tasks"].map((t) => (
            <span key={t} title="Coming soon" className="shrink-0">
              <button
                type="button"
                role="tab"
                aria-selected="false"
                aria-disabled="true"
                disabled
                className="min-h-10 cursor-not-allowed px-3 text-sm text-fg-muted opacity-60"
              >
                {t}
                <span className="sr-only"> (coming soon)</span>
              </button>
            </span>
          ))}
        </div>
        <div id="task-panel-activity" role="tabpanel" aria-labelledby="task-tab-activity" className="pt-4">
          <ActivityTimeline key={`${panel.id}:${panel.activity.entries[0]?.id ?? "none"}`} taskId={panel.id} initial={panel.activity} />
        </div>
      </section>
    </div>
  );
}

// ── Activity ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: "all", label: "All Activities" },
  { key: "status", label: "Status" },
  { key: "edits", label: "Edits" },
  { key: "people", label: "People" },
  { key: "assets", label: "Assets" },
];
const KIND = {
  created: { Icon: Plus, tone: "bg-track text-fg" },
  status_changed: { Icon: ArrowRightLeft, tone: "bg-success/15 text-success" },
  updated: { Icon: Pencil, tone: "bg-accent-soft text-accent-fg" },
  assignee_changed: { Icon: UserRound, tone: "bg-info/10 text-info" },
  reviewer_changed: { Icon: UserCheck, tone: "bg-info/10 text-info" },
  assets_changed: { Icon: Layers, tone: "bg-warning/15 text-warning" },
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
