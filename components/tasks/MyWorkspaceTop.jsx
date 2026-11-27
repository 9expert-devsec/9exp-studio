"use client";

// My Workspace (round 58, Figma 399:4309 / 399:4715) — the fixed top above the
// shared All Tasks body: the main tabs (งานของฉัน / งานที่เสร็จแล้ว, with counts) and,
// on งานของฉัน, two cards:
//   Work Plan วันนี้  my plans + actual logs today on two 24 h tracks (แผน / ทำจริง),
//                    axis 00:00 … 24:00, a red "now" line (minute timer). A block's
//                    tooltip = task + range; a click opens that task's drawer on its
//                    Work Plan tab (?task=&taskTab=work_plan). Hours-only entries
//                    draw like the Work Plan tab (dashed plan / short actual stub).
//   รอฉันตรวจ        reviews waiting for my verdict; "เปิด Review Queue ›" stays
//                    disabled ("เร็วๆ นี้") until that page exists (nav href null).
// The skeleton (MyWorkspaceTopSkeleton) has the same boxes at the same heights.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { openTaskPanel } from "@/components/tasks/TaskOpenLink";
import { cardClass } from "@/components/ui/Card";
import { MY_TABS, tasksHref } from "@/lib/tasks/allTasksFilters";
import { DAY_MIN, entryLabel, toMin } from "@/lib/tasks/workplan";

const CARD_H = "lg:h-[148px]";
const pct = (min) => `${(min / DAY_MIN) * 100}%`;
const TICKS = Array.from({ length: 9 }, (_, i) => i * 3);
const tabBase = "inline-flex min-h-10 items-center gap-2 border-b-2 px-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-500";
const COUNT = "inline-flex min-w-6 justify-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums";

/** งานของฉัน / งานที่เสร็จแล้ว (links; switching resets chip, sort and grouping). */
export function MyTabs({ f, counts }) {
  return (
    <nav aria-label="My Workspace" className="shadow-[inset_0_-1px_0_var(--ds-line)]">
      <ul className="flex gap-6">
        {MY_TABS.map((t) => {
          const active = f ? f.ws === t.key : t.key === "open";
          const n = counts?.[t.key];
          const body = (
            <>
              {t.label}
              <span className={`${COUNT} ${active ? "bg-accent-soft text-accent-fg" : "bg-track text-fg-muted"}`}>{n ?? <span className="invisible">00</span>}</span>
            </>
          );
          const cls = `${tabBase} ${active ? "border-brand-500 font-semibold text-accent-fg" : "border-transparent text-fg-muted hover:text-fg"}`;
          return (
            <li key={t.key}>
              {f ? (
                <Link href={tasksHref(f, { ws: t.key })} scroll={false} aria-current={active ? "page" : undefined} className={cls}>
                  {body}
                </Link>
              ) : (
                <span className={cls}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The current Bangkok minute of the day, kept current (null until mounted: no hydration mismatch). */
function useNowMinute() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date(Date.now() + 7 * 3600 * 1000);
      setNow(d.getUTCHours() * 60 + d.getUTCMinutes());
    };
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);
  return now;
}

function Block({ e, kind }) {
  const plan = kind === "plan";
  const title = `${e.taskTitle} · ${e.mode === "range" ? entryLabel(e) : `ไม่ระบุเวลา ${entryLabel(e)}`}${e.linked ? " · จากนัดถ่าย" : ""}`;
  let style;
  let look;
  if (e.mode === "range") {
    const s = toMin(e.start);
    style = { left: pct(s), width: `max(6px, ${pct(toMin(e.end) - s)})` };
    look = plan ? "bg-plan" : "bg-brand-500";
  } else if (plan) {
    style = { left: 0, right: 0 };
    look = "border border-dashed border-plan bg-transparent";
  } else {
    style = { left: 0, width: `max(6px, ${pct(e.minutes)})` };
    look = "bg-brand-500 opacity-50";
  }
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => openTaskPanel(e.task, { tab: "work_plan" })}
      style={style}
      className={`absolute inset-y-1 rounded-[5px] ${look} hover:ring-2 hover:ring-fg/30 focus-visible:outline-2 focus-visible:outline-brand-500`}
    />
  );
}

function Track({ label, entries, kind, now }) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs text-fg-muted">{label}</span>
      <div className="relative h-7 rounded-[8px] bg-card-inset">
        {TICKS.slice(1, -1).map((h) => (
          <span key={h} aria-hidden="true" className="absolute inset-y-0 w-px bg-line" style={{ left: pct(h * 60) }} />
        ))}
        {entries.map((e) => (
          <Block key={e.id} e={e} kind={kind} />
        ))}
        {now != null && <span aria-hidden="true" className="pointer-events-none absolute -inset-y-1 w-0.5 rounded-full bg-danger" style={{ left: pct(now) }} />}
      </div>
    </div>
  );
}

/** Work Plan วันนี้ (Figma 399:4309, left card). */
export function WorkPlanTodayCard({ dayLabel, workPlan }) {
  const now = useNowMinute();
  const plans = workPlan.entries.filter((e) => e.kind === "plan");
  const logs = workPlan.entries.filter((e) => e.kind === "log");
  const t = workPlan.totals;
  return (
    <section aria-labelledby="wp-today-title" className={`${cardClass({ size: "sm" })} ${CARD_H} grid gap-4 md:grid-cols-[11rem_minmax(0,1fr)]`}>
      <div className="flex flex-col justify-center gap-1">
        <h2 id="wp-today-title" className="text-sm font-bold text-fg">
          Work Plan วันนี้ <span className="font-normal text-fg-muted">· {dayLabel}</span>
        </h2>
        <p className="mt-1 text-sm text-fg">
          <span className="text-fg-muted">แผน</span> <span className="font-semibold text-plan-fg">{t.planLabel}</span>
        </p>
        <p className="text-sm text-fg">
          <span className="text-fg-muted">ทำจริง</span> <span className="font-semibold text-accent-fg">{t.actualLabel}</span>
        </p>
      </div>
      {t.empty ? (
        <p className="flex items-center justify-center rounded-[12px] bg-card-inset px-4 py-6 text-center text-sm text-fg-muted">วันนี้ยังไม่มีแผนหรือเวลาที่บันทึก</p>
      ) : (
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <Track label="แผน" entries={plans} kind="plan" now={now} />
          <Track label="ทำจริง" entries={logs} kind="log" now={now} />
          <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2" aria-hidden="true">
            <span />
            <div className="relative h-4 text-[10px] tabular-nums text-fg-muted">
              {TICKS.map((h) => (
                <span key={h} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(h * 60) }}>
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** รอฉันตรวจ (right card). `href` null = Review Queue not built yet (disabled link). */
export function WaitingReviewCard({ count, subline, href = null }) {
  return (
    <section aria-labelledby="review-wait-title" className={`${cardClass({ size: "sm" })} ${CARD_H} flex flex-col justify-between gap-2`}>
      <div>
        <h2 id="review-wait-title" className="flex items-center gap-2 text-sm font-bold text-fg">
          <ClipboardCheck className="size-4 text-fg-muted" aria-hidden="true" />
          รอฉันตรวจ
        </h2>
        <p className="mt-2 text-2xl font-bold tabular-nums text-fg">{count} งาน</p>
        <p className="truncate text-xs text-fg-muted" title={subline}>{subline}</p>
      </div>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 self-start rounded text-sm font-semibold text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
          เปิด Review Queue <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span title="เร็วๆ นี้" aria-disabled="true" className="inline-flex cursor-not-allowed items-center gap-1 self-start text-sm font-semibold text-fg-muted opacity-60">
          เปิด Review Queue <ChevronRight className="size-4" aria-hidden="true" />
          <span className="sr-only">(เร็วๆ นี้)</span>
        </span>
      )}
    </section>
  );
}

/** Both cards (งานของฉัน only). */
export function MyCards({ children }) {
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">{children}</div>;
}

/** Same boxes at the same heights while the first visit loads. */
export function MyWorkspaceTopSkeleton() {
  const box = `${cardClass({ size: "sm" })} ${CARD_H} animate-pulse`;
  return (
    <>
      <MyTabs f={null} counts={null} />
      <MyCards>
        <div className={`${box} min-h-[148px]`}>
          <span className="block h-4 w-40 rounded bg-track" />
          <span className="mt-3 block h-3 w-28 rounded bg-track" />
          <span className="mt-2 block h-3 w-28 rounded bg-track" />
        </div>
        <div className={`${box} min-h-[148px]`}>
          <span className="block h-4 w-24 rounded bg-track" />
          <span className="mt-3 block h-7 w-20 rounded bg-track" />
        </div>
      </MyCards>
    </>
  );
}
