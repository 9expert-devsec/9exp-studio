"use client";

// Project Timeline tab (round 42; Figma 233:110 toolbar · 233:111 chart · 233:112
// unscheduled). Read-only: a task row / bar / post card opens the Task Detail
// panel (?task=<id>, TaskOpenLink); nothing is dragged or edited here.
// Round 43: the chart is a bounded card (max-height from its measured top offset);
// rows scroll vertically inside it under a fixed header; only the day grid scrolls
// horizontally (bodyRef.scrollLeft is the one source of truth — header and the
// bottom scrollbar strip follow it).
// State: scale + collapsed groups (remembered per viewer/device/project — prefs.js),
// filters (this visit only), the visible range label (from the scroll position).
// All dates / spans / rules come from lib/timeline/layout.js.

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Filter, ListChecks, Minus, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import IconButton from "@/components/ui/IconButton";
import Avatar from "@/components/ui/Avatar";
import TaskOpenLink from "@/components/tasks/TaskOpenLink";
import {
  SCALES,
  SCALE_KEYS,
  STATUS_GROUP_FILTERS,
  activeFilterCount,
  applyFilters,
  emptyFilters,
  monthSegments,
  rangeLabel,
  stepScale,
  timelineWindow,
  visibleDays,
} from "@/lib/timeline/layout";
import { enabledTaskTypes } from "@/lib/tasks/types";
import { useTimelinePrefs } from "./prefs";
import { AssigneeBadge, LEFT_VARS, TaskGlyph, TimelineBody, TimelineHeader, TimelineScrollbar } from "./TimelineChart";

const chipBtn = buttonClass("secondary", "min-h-9 rounded-full px-3.5");

/**
 * @param {{ viewerId: string, projectId: string, contentHref: string, nowMs: number,
 *           contents: { id: string, name: string, href: string, tasks: object[] }[],
 *           members: { id: string, name: string, avatarUrl: string | null }[] }} props
 */
export default function ProjectTimeline({ viewerId, projectId, contentHref, contents, members, nowMs }) {
  const [prefs, setPrefs] = useTimelinePrefs(viewerId, projectId);
  const [filters, setFilters] = useState(emptyFilters);
  const [range, setRange] = useState(null);
  const [unscheduledOpen, setUnscheduledOpen] = useState(true);
  const bodyRef = useRef(null);
  const headerRef = useRef(null);
  const anchorRef = useRef(null); // day (fractional) at the left third of the viewport
  const cardRef = useRef(null);
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const bodyId = useId();

  const scale = prefs.scale;
  const dayWidth = SCALES[scale].dayWidth;
  const win = timelineWindow(
    contents.flatMap((c) => c.tasks),
    nowMs
  );
  const months = monthSegments(win);
  const { rows, unscheduled } = applyFilters(contents, filters, nowMs);
  const collapsed = new Set(prefs.collapsed);
  const allCollapsed = rows.length > 0 && rows.every((r) => collapsed.has(r.id));

  // Geometry of the day-grid viewport (bodyRef = THE horizontal scroller).
  const metrics = () => {
    const el = bodyRef.current;
    if (!el) return null;
    const chart = el.clientWidth;
    return { el, chart, third: chart / 3, max: Math.max(0, el.scrollWidth - chart) };
  };

  // Bottom strip thumb: width = visible share of the grid, offset = scroll share.
  const thumbGeometry = (m) => {
    const tw = trackRef.current?.clientWidth ?? 0;
    const sw = m.el.scrollWidth || 1;
    const width = m.max > 0 ? Math.min(tw, Math.max(28, (tw * m.chart) / sw)) : tw;
    const left = m.max > 0 ? ((tw - width) * m.el.scrollLeft) / m.max : 0;
    return { tw, width, left };
  };

  const paintThumb = (m) => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const g = thumbGeometry(m);
    thumb.style.width = `${g.width}px`;
    thumb.style.transform = `translateX(${g.left}px)`;
    thumb.style.visibility = m.max > 0 ? "visible" : "hidden";
    trackRef.current?.setAttribute("aria-valuenow", String(m.max > 0 ? Math.round((m.el.scrollLeft / m.max) * 100) : 0));
  };

  // Header + strip follow the body's scrollLeft (one source of truth).
  const syncFromScroll = () => {
    const m = metrics();
    if (!m) return;
    if (headerRef.current) headerRef.current.scrollLeft = m.el.scrollLeft;
    paintThumb(m);
    anchorRef.current = win.start + (m.el.scrollLeft + m.third) / dayWidth;
    setRange(visibleDays(win, m.el.scrollLeft, m.chart, dayWidth));
  };

  // Strip: drag the thumb (pointer capture), click the track (jump), ‹ › (one week).
  const onThumbDown = (e) => {
    const m = metrics();
    if (!m || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const thumb = e.currentTarget;
    const g = thumbGeometry(m);
    const ratio = g.tw > g.width ? m.max / (g.tw - g.width) : 0;
    const startX = e.clientX;
    const startLeft = m.el.scrollLeft;
    thumb.setPointerCapture(e.pointerId);
    const move = (ev) => {
      m.el.scrollLeft = startLeft + (ev.clientX - startX) * ratio;
    };
    const up = () => {
      thumb.removeEventListener("pointermove", move);
      thumb.removeEventListener("pointerup", up);
      thumb.removeEventListener("pointercancel", up);
    };
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", up);
    thumb.addEventListener("pointercancel", up);
  };
  const onTrackDown = (e) => {
    const m = metrics();
    if (!m || e.button !== 0 || m.max <= 0) return;
    const g = thumbGeometry(m);
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const share = g.tw > g.width ? (x - g.width / 2) / (g.tw - g.width) : 0;
    m.el.scrollTo({ left: Math.min(m.max, Math.max(0, share * m.max)), behavior: "smooth" });
  };

  const hasRows = rows.length > 0;
  const hasContent = contents.length > 0;

  // Card height: bounded to the viewport below the card's own top (document offset,
  // measured — no fixed numbers), written as --tl-top on the card. Re-measured when
  // anything above it changes size (body resize) or the window resizes. Below lg
  // the page scroller is the window, so rect.top + scrollY is the document offset.
  // On lg+ (round 52) the project pages scroll inside #project-scroll, which every
  // page change resets to the top: rect.top is then the card's offset under the
  // pinned header (window.scrollY stays 0), and the card still fits the viewport.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => {
      const top = Math.max(0, Math.round(card.getBoundingClientRect().top + window.scrollY));
      card.style.setProperty("--tl-top", `${top}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [hasContent]);

  // On open: today at the left third. On a scale change: keep the anchor day there.
  const reanchor = useEffectEvent(() => {
    const m = metrics();
    if (!m) return;
    const anchor = anchorRef.current ?? win.today + 0.5;
    m.el.scrollLeft = Math.max(0, (anchor - win.start) * dayWidth - m.third);
    if (headerRef.current) headerRef.current.scrollLeft = m.el.scrollLeft;
    paintThumb(metrics());
  });
  useLayoutEffect(() => reanchor(), [dayWidth, win.start, hasRows]);

  // Range label, header offset and thumb also on resize / grid width change (no scroll event then).
  const onResize = useEffectEvent(() => syncFromScroll());
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onResize());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [hasRows]);

  const scrollByDays = (days) => bodyRef.current?.scrollBy({ left: days * dayWidth, behavior: "smooth" });
  const scrollToToday = () => {
    const m = metrics();
    if (m) m.el.scrollTo({ left: Math.max(0, (win.today + 0.5 - win.start) * dayWidth - m.third), behavior: "smooth" });
  };
  const setScale = (next) => next && setPrefs({ scale: next });
  const toggleGroup = (id) =>
    setPrefs({ collapsed: collapsed.has(id) ? prefs.collapsed.filter((x) => x !== id) : [...prefs.collapsed, id] });
  const toggleAll = () =>
    setPrefs({ collapsed: allCollapsed ? [] : [...new Set([...prefs.collapsed, ...rows.map((r) => r.id)])] });

  if (contents.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-brand-500">
          <ListChecks className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg text-fg">No content yet</h2>
        <p className="text-sm text-fg-muted">Add content and tasks to see them on the timeline.</p>
        <Link href={contentHref} className={buttonClass("secondary")}>
          Go to Content
        </Link>
      </Card>
    );
  }

  return (
    <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="timeline-heading" className="mr-1 text-xl font-bold text-fg">
          Project timeline
        </h2>
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronLeft} label={`Back ${SCALES[scale].step} days`} onClick={() => scrollByDays(-SCALES[scale].step)} />
          <button type="button" onClick={scrollToToday} className={chipBtn}>
            Today
          </button>
          <IconButton icon={ChevronRight} label={`Forward ${SCALES[scale].step} days`} onClick={() => scrollByDays(SCALES[scale].step)} />
        </div>
        <p className="min-w-[11rem] text-sm font-medium tabular-nums text-fg" aria-live="polite">
          {range ? rangeLabel(range.first, range.last) : " "}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <label className="sr-only" htmlFor="timeline-scale">
            Scale
          </label>
          <select
            id="timeline-scale"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            className="min-h-9 rounded-full border border-control-line bg-control px-3.5 pr-8 text-sm font-medium text-fg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {SCALE_KEYS.map((k) => (
              <option key={k} value={k}>
                {SCALES[k].label}
              </option>
            ))}
          </select>
          <IconButton icon={Minus} label="Zoom out" disabled={!stepScale(scale, 1)} onClick={() => setScale(stepScale(scale, 1))} />
          <IconButton icon={Plus} label="Zoom in" disabled={!stepScale(scale, -1)} onClick={() => setScale(stepScale(scale, -1))} />
          <FilterPopover filters={filters} setFilters={setFilters} members={members} />
          <button type="button" onClick={toggleAll} disabled={rows.length === 0} className={chipBtn}>
            {allCollapsed ? (
              <ChevronsUpDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronsDownUp className="size-4" aria-hidden="true" />
            )}
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        </div>
      </div>

      {/* Chart: a bounded card — fixed header, rows scrolling inside, strip pinned at the bottom. */}
      <div
        ref={cardRef}
        className={`relative flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-line bg-card ${LEFT_VARS}`}
        style={{ maxHeight: "max(420px, calc(100dvh - var(--tl-top, 0px) - 16px))" }}
      >
        <TimelineHeader win={win} dayWidth={dayWidth} months={months} scale={scale} headerRef={headerRef} />
        {hasRows ? (
          <TimelineBody
            bodyId={bodyId}
            rows={rows}
            collapsed={collapsed}
            onToggle={toggleGroup}
            win={win}
            dayWidth={dayWidth}
            months={months}
            scale={scale}
            nowMs={nowMs}
            bodyRef={bodyRef}
            onScroll={syncFromScroll}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-fg-muted">No tasks match these filters</p>
            <button type="button" onClick={() => setFilters(emptyFilters())} className={buttonClass("secondary")}>
              Clear filters
            </button>
          </div>
        )}
        {hasRows && (
          <TimelineScrollbar
            trackRef={trackRef}
            thumbRef={thumbRef}
            bodyId={bodyId}
            onThumbDown={onThumbDown}
            onTrackDown={onTrackDown}
            onStep={(dir) => scrollByDays(dir * 7)}
          />
        )}
      </div>

      <p className="text-xs text-fg-muted">Bars = work period · ◆ = scheduled post</p>

      {unscheduled.length > 0 && (
        <section aria-labelledby="unscheduled-heading" className="rounded-[16px] border border-line bg-card">
          <h3 id="unscheduled-heading">
            <button
              type="button"
              onClick={() => setUnscheduledOpen((v) => !v)}
              aria-expanded={unscheduledOpen}
              className="flex min-h-12 w-full items-center gap-2 rounded-[16px] px-4 text-left text-base font-bold text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <ChevronDown className={`size-4 text-fg-muted transition-transform ${unscheduledOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
              Unscheduled ({unscheduled.length})
            </button>
          </h3>
          {unscheduledOpen && (
            <ul className="divide-y divide-line-subtle border-t border-line-subtle">
              {unscheduled.map((t) => (
                <li key={t.id} className="flex min-h-11 items-center gap-2.5 px-4 py-1.5">
                  <TaskGlyph task={t} />
                  <TaskOpenLink
                    taskId={t.id}
                    href={t.openHref}
                    title={`${t.typeLabel} · ${t.title} (${t.contentName})`}
                    className="min-w-0 truncate rounded text-sm text-fg hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    <span className="font-semibold">{t.typeLabel}</span> · {t.title}
                  </TaskOpenLink>
                  <span className="hidden min-w-0 truncate text-xs text-fg-muted md:inline">{t.contentName}</span>
                  <span className="ml-auto shrink-0">
                    {t.assignee ? (
                      <AssigneeBadge task={t} withName />
                    ) : (
                      <span className="rounded-full bg-track px-2 py-0.5 text-[11px] font-medium text-fg-muted">Unassigned</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Filter popover

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-9 w-full items-center justify-between gap-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-500" : "bg-track"}`}>
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function CheckRow({ checked, onChange, children }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm text-fg">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 accent-brand-500" />
      {children}
    </label>
  );
}

const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function FilterPopover({ filters, setFilters, members }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();
  const count = activeFilterCount(filters);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const legend = "mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted";
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={chipBtn}
      >
        <Filter className="size-4" aria-hidden="true" />
        Filter
        {count > 0 && (
          <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-bold leading-5 text-navy">
            {count}
            <span className="sr-only"> active</span>
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Filter timeline"
          className="absolute right-0 top-full z-40 mt-2 flex max-h-[min(70vh,560px)] w-[min(18rem,calc(100vw-2rem))] flex-col gap-4 overflow-y-auto rounded-[18px] border border-line bg-card p-4 shadow-xl"
        >
          <fieldset>
            <legend className={legend}>Task type</legend>
            {enabledTaskTypes().map((t) => (
              <CheckRow key={t.key} checked={filters.types.includes(t.key)} onChange={() => set({ types: toggleIn(filters.types, t.key) })}>
                <t.icon className="size-4 text-fg-muted" aria-hidden="true" />
                {t.label}
              </CheckRow>
            ))}
          </fieldset>
          <fieldset>
            <legend className={legend}>Assignee</legend>
            {members.map((m) => (
              <CheckRow
                key={m.id}
                checked={filters.assignees.includes(m.id)}
                onChange={() => set({ assignees: toggleIn(filters.assignees, m.id) })}
              >
                <Avatar name={m.name} url={m.avatarUrl} size={20} />
                <span className="truncate">{m.name}</span>
              </CheckRow>
            ))}
          </fieldset>
          <fieldset>
            <legend className={legend}>Status</legend>
            {STATUS_GROUP_FILTERS.map((g) => (
              <CheckRow key={g.key} checked={filters.groups.includes(g.key)} onChange={() => set({ groups: toggleIn(filters.groups, g.key) })}>
                {g.label}
              </CheckRow>
            ))}
          </fieldset>
          <div className="border-t border-line-subtle pt-2">
            <Switch checked={filters.showCancelled} onChange={(v) => set({ showCancelled: v })} label="Show cancelled" />
            <Switch checked={filters.overdueOnly} onChange={(v) => set({ overdueOnly: v })} label="Overdue only" />
          </div>
          <button type="button" disabled={count === 0} onClick={() => setFilters(emptyFilters())} className={buttonClass("secondary", "w-full")}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
