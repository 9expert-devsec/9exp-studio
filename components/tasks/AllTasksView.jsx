// All Tasks page body (rounds 56–57): tabs, toolbar, then the table or the
// calendar, and the legend — plus the first-visit skeleton built from the SAME
// rows / class constants, so nothing moves when the data arrives. No hooks here
// (server-rendered); toolbar, table and calendar are client islands.
//
// Round 57 — pinned layout (lg+): the top (tabs + toolbar) never scrolls; BODY
// fills what is left and its card (table or calendar) scrolls INSIDE itself —
// the scrollbar sits inside the card frame, the column header is sticky, the
// table footer is pinned below the scroll area. The window never scrolls.
//
// Round 58: also the My Workspace body (f.scope "mine"): the chips come from
// chipsFor(f); `header` (its main tabs + cards) sits at the top of the fixed part.

import Link from "next/link";
import { TAB_BASE, TAB_IDLE_COLOR, TAB_LIST, TAB_NAV } from "@/components/projects/projectTopStyles";
import { cardClass } from "@/components/ui/Card";
import AllTasksCalendar from "./AllTasksCalendar";
import AllTasksTable from "./AllTasksTable";
import AllTasksToolbar from "./AllTasksToolbar";
import { BODY, CARD_FILL, ROW_SKELETON_H, SCROLLER, STICKY_HEAD, TABLE_HEAD, TOOLBAR_H } from "./allTasksStyles";
import { ALL_TASKS_TABS, chipsFor, tasksHref } from "@/lib/tasks/allTasksFilters";
import { TASK_STAGES, taskTypes } from "@/lib/tasks/types";

const TOP = "flex shrink-0 flex-col gap-4";
const COUNT = "ml-2 inline-flex min-w-6 justify-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums";

const PILL = "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand-500";

/** All Tasks: underline tabs. My Workspace (`pill`): quick chips under its main tabs. */
function Tabs({ f, counts, chips = ALL_TASKS_TABS, pill = f?.scope === "mine" }) {
  return (
    <nav aria-label={pill ? "ตัวกรองด่วน" : "Task tabs"} className={pill ? "" : TAB_NAV}>
      <ul className={pill ? "flex flex-wrap gap-2" : `${TAB_LIST} overflow-x-auto no-scrollbar`}>
        {(f ? chipsFor(f) : chips).map((t, i) => {
          const active = f ? f.tab === t.key : pill && i === 0;
          const n = counts?.[t.key];
          const tone = active ? "bg-accent-soft text-accent-fg" : t.key === "overdue" && n ? "bg-danger/15 text-danger" : "bg-track text-fg-muted";
          const body = (
            <>
              {t.label}
              <span className={`${COUNT} ${tone}`}>{n ?? <span className="invisible">00</span>}</span>
            </>
          );
          const cls = pill
            ? `${PILL} ${active ? "border-brand-500 bg-accent-soft font-semibold text-accent-fg" : "border-line bg-card text-fg hover:bg-card-inset"}`
            : `${TAB_BASE} whitespace-nowrap ${
                active ? "border-brand-500 font-semibold text-accent-fg" : `${TAB_IDLE_COLOR} hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500`
              }`;
          return (
            <li key={t.key} className="shrink-0">
              {f ? (
                <Link href={tasksHref(f, { tab: t.key })} scroll={false} aria-current={active ? "page" : undefined} className={cls}>
                  {body}
                </Link>
              ) : (
                <span className={pill ? cls : `${TAB_BASE} whitespace-nowrap ${TAB_IDLE_COLOR}`}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const dot = (cls) => <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${cls}`} />;

function TableLegend() {
  return (
    <p className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      <span>กลุ่มสถานะ:</span>
      {TASK_STAGES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          {dot(s.dot)}
          {s.label}
        </span>
      ))}
    </p>
  );
}

/** Calendar legend: type colours (real names) + the symbols. */
function CalendarLegend() {
  const swatch = "inline-block h-2.5 w-4 shrink-0 rounded-[3px]";
  return (
    <p className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      <span>สีตามประเภท:</span>
      {["clip", "production", "graphic", "article", "photo", "post"].map((key) => {
        const t = taskTypes().find((x) => x.key === key);
        return (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`${swatch} ${t.tone}`} />
            {t.label}
          </span>
        );
      })}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`${swatch} border border-dashed border-danger bg-danger/10`} />
        เลยกำหนด
      </span>
      <span className="inline-flex items-center gap-1.5">
        {dot("bg-fg")}
        วันนัด / วันเผยแพร่
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`${swatch} bg-track opacity-50`} />
        จาง = เสร็จแล้ว
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`${swatch} rounded-r-none bg-track`} />
        ขอบตัด ‹ › = ต่อสัปดาห์ก่อน / ถัดไป
      </span>
    </p>
  );
}

/**
 * @param {{ f: object, data: object, header?: import("react").ReactNode }} props
 *   f = parseAllTasks(); data = loadAllTasks() or loadAllTasksCalendar(); header = My Workspace tabs + cards
 */
export function AllTasksView({ f, data, header = null }) {
  const calendar = f.view === "calendar";
  return (
    <>
      <div className={TOP}>
        {header}
        <Tabs f={f} counts={data.counts} />
        <AllTasksToolbar projects={data.projects} people={data.people} />
      </div>
      <div className={BODY}>
        {calendar ? <AllTasksCalendar f={f} data={data} /> : <AllTasksTable f={f} data={data} />}
        {calendar ? <CalendarLegend /> : <TableLegend />}
      </div>
    </>
  );
}

/**
 * First visit: the same tab row, a toolbar of the same height, and the table card
 * filling the body. `header` / `chips`: My Workspace's skeleton tabs + cards and its chips.
 */
export function AllTasksSkeleton({ header = null, chips = ALL_TASKS_TABS, pill = false }) {
  const bar = "rounded-[10px] bg-track";
  return (
    <>
      <div className={TOP} aria-hidden="true">
        {header}
        <Tabs f={null} counts={null} chips={chips} pill={pill} />
        <div className="flex animate-pulse flex-wrap items-center gap-2">
          <span className={`${TOOLBAR_H} min-w-0 flex-1 ${bar}`} />
          <span className={`${TOOLBAR_H} w-28 ${bar}`} />
          <span className={`${TOOLBAR_H} w-40 ${bar}`} />
        </div>
      </div>
      <div className={BODY} aria-hidden="true">
        <div className={`${cardClass({ size: "sm", padded: false })} ${CARD_FILL}`}>
          <div className={`${SCROLLER} animate-pulse`}>
            <div className={`${STICKY_HEAD} ${TABLE_HEAD}`} />
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className={`flex items-center gap-4 border-b border-line-subtle px-4 ${ROW_SKELETON_H}`}>
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
        </div>
        <TableLegend />
      </div>
    </>
  );
}
