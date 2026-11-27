"use client";

// All Tasks table (round 56, Figma 386:1241 / 386:1757 / 2242 / 2738 / 3236).
// Columns: Task · สถานะ · ผู้รับผิดชอบ · Due (no checkbox column this round).
// Data comes shaped from lib/tasks/allTasks.js; the only local state is which
// group sections are collapsed (pure UI, not URL-derived).
//
// Round 57: the card fills the page body and scrolls INSIDE itself (SCROLLER);
// the column header is sticky (opaque, bottom line), group headers scroll, the
// footer is pinned under the scroll area. Any change of page / tab / filter /
// search / grouping / sort scrolls the body back to the top.
//
// A row opens the Task Detail panel on THIS page (TaskOpenLink → ?task=<id>, every
// other param kept); the whole row is the link's hit area (stretched link).
// Grouping hides what the group header already says: project → no project name
// in line 2, type → no type badge, assignee → empty ผู้รับผิดชอบ cell.
//
// Round 58 (My Workspace, f.scope "mine"): column 3 is บทบาทของฉัน (row.role);
// the Task cell gets "แผนวันนี้ N ช่วง" (row.planToday); on งานที่เสร็จแล้ว the
// columns are Task · สถานะสุดท้าย · บทบาทของฉัน · เสร็จเมื่อ (sortable).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, ChevronDown, ChevronRight, SearchX } from "lucide-react";
import TaskOpenLink from "@/components/tasks/TaskOpenLink";
import { ProjectIconTile } from "@/components/projects/ProjectBits";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import { allTasksQuery, clearedFilters, hasNarrowing, tasksHref } from "@/lib/tasks/allTasksFilters";
import { STOPPED_STAGE, TASK_STAGES, taskTypeTone } from "@/lib/tasks/types";
import { CARD_FILL, COL, ROW_SKELETON_H, SCROLLER, STICKY_HEAD, TABLE_HEAD } from "./allTasksStyles";

const th = `${STICKY_HEAD} px-4 text-left text-xs font-semibold text-fg-muted`;
const td = "px-4 py-3 align-middle";
const stageOf = (key) => TASK_STAGES.find((s) => s.key === key) ?? STOPPED_STAGE;

/** The type badge: the catalog's real name in the type's tint. */
export function TypeBadge({ type, label }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${taskTypeTone(type)}`}>{label}</span>;
}

function SortHeader({ f, field, label }) {
  const asc = f.sort === field;
  const desc = f.sort === `-${field}`;
  const next = asc ? `-${field}` : field;
  const Icon = asc ? ArrowUp : desc ? ArrowDown : ArrowUpDown;
  return (
    <th scope="col" aria-sort={asc ? "ascending" : desc ? "descending" : "none"} className={th}>
      <Link
        href={tasksHref(f, { sort: next })}
        scroll={false}
        className="inline-flex items-center gap-1 rounded hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </Link>
    </th>
  );
}

function StatusCell({ row }) {
  const stage = stageOf(row.stage);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex min-w-0 items-center gap-1.5 text-sm">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${stage.dot}`} />
        <span className="truncate font-medium text-fg">{row.statusLabel}</span>
        {row.step && (
          <span className="shrink-0 text-xs tabular-nums text-fg-muted">
            {row.step.n}/{row.step.total}
          </span>
        )}
      </span>
      {row.step && (
        // Step bar: one segment per drawn step, the first n in the stage colour.
        <span aria-hidden="true" className="flex max-w-[190px] gap-1">
          {Array.from({ length: row.step.total }, (_, i) => (
            <span key={i} className={`h-[3px] flex-1 rounded-full ${i < row.step.n ? stage.dot : "bg-track"}`} />
          ))}
        </span>
      )}
    </div>
  );
}

function PersonCell({ row }) {
  if (!row.assignee) return <span className="text-sm text-fg-muted">–</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={row.assignee.name} url={row.assignee.avatarUrl} size={28} />
      <span className="truncate text-sm text-fg">{row.assignee.name}</span>
      {row.extra > 0 && (
        <span className="shrink-0 rounded-full bg-track px-1.5 py-px text-[11px] font-semibold text-fg-muted">
          +{row.extra}
          <span className="sr-only"> more {row.extra === 1 ? "person" : "people"}</span>
        </span>
      )}
    </span>
  );
}

/** บทบาทของฉัน (round 58): the role + its detail / other roles. */
function RoleCell({ role }) {
  if (!role) return <span className="text-sm text-fg-muted">–</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium text-fg">{role.label}</span>
      {role.sub && <span className="truncate text-xs text-fg-muted" title={role.sub}>{role.sub}</span>}
    </span>
  );
}

function Row({ row, f }) {
  const group = f.group;
  const mine = f.scope === "mine";
  const done = mine && f.ws === "done";
  return (
    <tr className={`relative transition-colors hover:bg-card-inset/60 ${ROW_SKELETON_H}`}>
      <td className={`${td} max-w-0`}>
        <span className="flex min-w-0 items-center gap-2">
          <TaskOpenLink
            taskId={row.id}
            href={row.openHref}
            className="block min-w-0 truncate rounded text-sm font-semibold text-fg outline-none after:absolute after:inset-0 after:content-[''] hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-brand-500"
            title={row.title}
          >
            {row.title}
          </TaskOpenLink>
          {row.planToday > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-plan-soft px-2 py-0.5 text-[11px] font-semibold text-plan-fg">
              <CalendarClock className="size-3" aria-hidden="true" />
              แผนวันนี้ {row.planToday} ช่วง
            </span>
          )}
        </span>
        <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-fg-muted">
          {group !== "type" && <TypeBadge type={row.type} label={row.typeLabel} />}
          <span className="shrink-0 font-mono">{row.code}</span>
          <span className="flex min-w-0 items-center gap-1 truncate">
            {group !== "project" && row.projectName && (
              <>
                <span className="font-medium text-fg">{row.projectName}</span>
                {row.contentName && <ChevronRight className="size-3 shrink-0" aria-hidden="true" />}
              </>
            )}
            {row.contentName && <span className="truncate">{row.contentName}</span>}
          </span>
        </p>
      </td>
      <td className={td}>
        <StatusCell row={row} />
      </td>
      <td className={`${td} max-w-0`}>
        {mine ? <RoleCell role={row.role} /> : group === "assignee" ? <span className="sr-only">{row.assignee?.name ?? "–"}</span> : <PersonCell row={row} />}
      </td>
      {done ? (
        <td className={`${td} whitespace-nowrap text-sm text-fg`}>{row.doneLabel}</td>
      ) : (
        <td className={`${td} whitespace-nowrap text-sm ${row.due.overdue ? "font-semibold text-danger" : "text-fg"}`}>{row.due.label}</td>
      )}
    </tr>
  );
}

function GroupLabel({ label }) {
  if (label.kind === "project") {
    return (
      <>
        {label.icon && <ProjectIconTile icon={label.icon} size="sm" className="size-7! rounded-[9px]!" />}
        <span className="truncate">{label.name}</span>
      </>
    );
  }
  if (label.kind === "type") return <TypeBadge type={label.type} label={label.name} />;
  if (label.kind === "assignee") {
    return (
      <>
        {!label.empty && <Avatar name={label.name} url={label.avatarUrl} size={24} />}
        <span className={`truncate ${label.empty ? "text-fg-muted" : ""}`}>{label.name}</span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className={`size-2.5 rounded-full ${label.dot}`} />
      <span className="truncate">{label.name}</span>
    </>
  );
}

function GroupHeader({ g, collapsed, onToggle }) {
  const t = g.totals ?? { count: g.rows.length, overdue: 0, stages: {} };
  return (
    <tr className="bg-card-inset/70">
      <td colSpan={4} className="px-2 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="flex min-w-0 items-center gap-2 rounded-[8px] px-2 py-1 text-sm font-semibold text-fg hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ChevronDown className={`size-4 shrink-0 text-fg-muted transition-transform ${collapsed ? "-rotate-90" : ""}`} aria-hidden="true" />
            <GroupLabel label={g.label} />
            {g.continued && <span className="shrink-0 text-xs font-normal text-fg-muted">(ต่อ)</span>}
          </button>
          <span className="shrink-0 text-xs text-fg-muted">{t.count} งาน</span>
          {t.overdue > 0 && <span className="shrink-0 text-xs font-semibold text-danger">เลยกำหนด {t.overdue}</span>}
          <span className="ml-auto hidden shrink-0 items-center gap-3 pr-2 text-xs text-fg-muted sm:flex">
            {TASK_STAGES.filter((s) => t.stages[s.key]).map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={`size-2 rounded-full ${s.dot}`} />
                {s.label} {t.stages[s.key]}
              </span>
            ))}
          </span>
        </div>
      </td>
    </tr>
  );
}

/** @param {{ f: object, data: object }} props */
export default function AllTasksTable({ f, data }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  // Back to the top whenever the list itself changes (not when ?task= opens the panel).
  const scrollRef = useRef(null);
  const listKey = allTasksQuery(f, {}, { keepPage: true });
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [listKey]);
  const toggle = (key) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!data.rows.length) {
    const narrowed = hasNarrowing(f);
    // Round 58: My Workspace says what is missing when nothing narrows the list.
    const text = narrowed || f.scope !== "mine" ? "ไม่พบงานตามเงื่อนไข" : f.ws === "done" ? "ยังไม่มีงานที่เสร็จในช่วงนี้" : "ยังไม่มีงานที่ได้รับมอบหมาย";
    return (
      <div className={`${cardClass({ size: "sm" })} flex flex-col items-center gap-3 py-16 text-center`}>
        <SearchX className="size-8 text-fg-muted" aria-hidden="true" />
        <p className="text-sm text-fg">{text}</p>
        {narrowed && (
          <Link
            href={tasksHref(f, clearedFilters(f))}
            scroll={false}
            className={buttonClass("secondary", "min-h-9")}
          >
            ล้างตัวกรอง
          </Link>
        )}
      </div>
    );
  }

  const sections = f.group ? data.groups : [{ key: "", rows: data.rows }];
  const mine = f.scope === "mine";
  const done = mine && f.ws === "done";
  const range = `${data.from}–${data.to} จาก ${data.total} งาน`;

  return (
    <div className={`${cardClass({ size: "sm", padded: false })} ${CARD_FILL}`}>
      <div ref={scrollRef} className={SCROLLER}>
        <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-0">
          <colgroup>
            <col />
            <col className={COL.status} />
            <col className={COL.person} />
            <col className={COL.due} />
          </colgroup>
          <thead>
            <tr className={TABLE_HEAD}>
              <SortHeader f={f} field="task" label="Task" />
              <th scope="col" className={th}>{done ? "สถานะสุดท้าย" : "สถานะ"}</th>
              <th scope="col" className={th}>{mine ? "บทบาทของฉัน" : "ผู้รับผิดชอบ"}</th>
              {done ? <SortHeader f={f} field="done" label="เสร็จเมื่อ" /> : <SortHeader f={f} field="due" label="Due" />}
            </tr>
          </thead>
          {sections.map((g) => (
            <tbody key={g.key || "all"} className="[&_td]:border-b [&_td]:border-line-subtle">
              {f.group && <GroupHeader g={g} collapsed={collapsed.has(g.key)} onToggle={() => toggle(g.key)} />}
              {!collapsed.has(g.key) && g.rows.map((r) => <Row key={r.id} row={r} f={f} />)}
            </tbody>
          ))}
        </table>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <p className="text-sm text-fg-muted">
          {f.group ? `แสดง ${data.groups.length} กลุ่ม · ${range}` : `แสดง ${range}`}
        </p>
        <Pagination
          page={data.page}
          pages={data.pages}
          hrefFor={(p) => tasksHref(f, { page: p })}
          label="หน้า"
        />
      </div>
    </div>
  );
}
