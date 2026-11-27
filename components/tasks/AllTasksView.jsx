// All Tasks page body (round 56): tabs, toolbar, table + legend — and the
// first-visit skeleton built from the SAME rows / class constants, so nothing above
// the table moves when the data arrives. No hooks here (server-rendered); the
// toolbar and the table are client islands.

import Link from "next/link";
import { CalendarDays, List } from "lucide-react";
import { TAB_BASE, TAB_IDLE_COLOR, TAB_LIST, TAB_NAV } from "@/components/projects/projectTopStyles";
import { cardClass } from "@/components/ui/Card";
import AllTasksTable from "./AllTasksTable";
import AllTasksToolbar from "./AllTasksToolbar";
import { ROW_SKELETON_H, TABLE_HEAD, TOOLBAR_H } from "./allTasksStyles";
import { ALL_TASKS_PATH, ALL_TASKS_TABS, allTasksQuery } from "@/lib/tasks/allTasksFilters";
import { TASK_STAGES } from "@/lib/tasks/types";

/** In-app scroll container (round 52 pattern, like #project-scroll). */
const SCROLL = "app-scrollbar lg:-ml-1 lg:-mr-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-[26px] lg:pl-1 lg:pr-3";
const TOP = "flex shrink-0 flex-col gap-4";
const COUNT = "ml-2 inline-flex min-w-6 justify-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums";

/** ตาราง (current) / ปฏิทิน (next round: disabled, "เร็วๆ นี้"). */
export function ViewToggle() {
  const seg = "inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-3 text-sm";
  return (
    <div role="group" aria-label="มุมมอง" className="inline-flex gap-0.5 rounded-[12px] border border-control-line bg-control p-0.5">
      <span aria-current="true" className={`${seg} bg-card font-semibold text-fg shadow-sm`}>
        <List className="size-4" aria-hidden="true" />
        ตาราง
      </span>
      <button type="button" disabled title="เร็วๆ นี้" aria-label="ปฏิทิน (เร็วๆ นี้)" className={`${seg} cursor-not-allowed text-fg-muted opacity-60`}>
        <CalendarDays className="size-4" aria-hidden="true" />
        ปฏิทิน
      </button>
    </div>
  );
}

function Tabs({ f, counts }) {
  return (
    <nav aria-label="Task tabs" className={TAB_NAV}>
      <ul className={`${TAB_LIST} overflow-x-auto no-scrollbar`}>
        {ALL_TASKS_TABS.map((t) => {
          const active = f?.tab === t.key;
          const n = counts?.[t.key];
          const tone = active ? "bg-accent-soft text-accent-fg" : t.key === "overdue" && n ? "bg-danger/15 text-danger" : "bg-track text-fg-muted";
          const body = (
            <>
              {t.label}
              <span className={`${COUNT} ${tone}`}>{n ?? <span className="invisible">00</span>}</span>
            </>
          );
          return (
            <li key={t.key} className="shrink-0">
              {f ? (
                <Link
                  href={`${ALL_TASKS_PATH}${allTasksQuery(f, { tab: t.key })}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`${TAB_BASE} whitespace-nowrap ${
                    active
                      ? "border-brand-500 font-semibold text-accent-fg"
                      : `${TAB_IDLE_COLOR} hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500`
                  }`}
                >
                  {body}
                </Link>
              ) : (
                <span className={`${TAB_BASE} whitespace-nowrap ${TAB_IDLE_COLOR}`}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Legend() {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      <span>กลุ่มสถานะ:</span>
      {TASK_STAGES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      ))}
    </p>
  );
}

/** @param {{ f: object, data: object }} props  f = parseAllTasks(), data = loadAllTasks() */
export function AllTasksView({ f, data }) {
  return (
    <>
      <div className={TOP}>
        <Tabs f={f} counts={data.counts} />
        <AllTasksToolbar projects={data.projects} people={data.people} />
      </div>
      <div className={SCROLL}>
        <AllTasksTable f={f} data={data} />
        <Legend />
      </div>
    </>
  );
}

/** First visit: the same tab row, a toolbar of the same height, and the table frame. */
export function AllTasksSkeleton() {
  const bar = "rounded-[10px] bg-track";
  return (
    <>
      <div className={TOP} aria-hidden="true">
        <Tabs f={null} counts={null} />
        <div className="flex animate-pulse flex-wrap items-center gap-2">
          <span className={`${TOOLBAR_H} min-w-0 flex-1 ${bar}`} />
          <span className={`${TOOLBAR_H} w-28 ${bar}`} />
          <span className={`${TOOLBAR_H} w-40 ${bar}`} />
        </div>
      </div>
      <div className={SCROLL} aria-hidden="true">
        <div className={`${cardClass({ size: "sm", padded: false })} animate-pulse overflow-hidden`}>
          <div className={`${TABLE_HEAD} border-b border-line`} />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`flex items-center gap-4 border-b border-line-subtle px-4 last:border-0 ${ROW_SKELETON_H}`}>
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-4 w-2/5 rounded bg-track" />
                <span className="h-3 w-3/5 rounded bg-track" />
              </span>
              <span className="h-4 w-40 rounded bg-track" />
              <span className="h-6 w-36 rounded-full bg-track" />
              <span className="h-4 w-16 rounded bg-track" />
            </div>
          ))}
        </div>
        <Legend />
      </div>
    </>
  );
}
