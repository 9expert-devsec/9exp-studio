"use client";

// ตาราง / ปฏิทิน (round 57: the calendar is live). Real links; the view is the URL
// (?view=calendar), so every other param — tab, search, filters — carries over.

import Link from "next/link";
import { CalendarDays, List } from "lucide-react";
import { tasksHref } from "@/lib/tasks/allTasksFilters";
import { useAllTasksState } from "./useAllTasksState";

const seg = "inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-500";
const on = `${seg} bg-card font-semibold text-fg shadow-sm`;
const off = `${seg} text-fg-muted hover:text-fg`;
const GROUP = "inline-flex gap-0.5 rounded-[12px] border border-control-line bg-control p-0.5";

export default function AllTasksViewToggle() {
  const f = useAllTasksState();
  const cal = f.view === "calendar";
  // Round 58: My Workspace งานที่เสร็จแล้ว is a table only.
  if (f.scope === "mine" && f.ws === "done") return null;
  return (
    <div role="group" aria-label="มุมมอง" className={GROUP}>
      <Link href={tasksHref(f, { view: "table" }, { keepPage: true })} scroll={false} aria-current={cal ? undefined : "true"} className={cal ? off : on}>
        <List className="size-4" aria-hidden="true" />
        ตาราง
      </Link>
      <Link href={tasksHref(f, { view: "calendar" })} scroll={false} aria-current={cal ? "true" : undefined} className={cal ? on : off}>
        <CalendarDays className="size-4" aria-hidden="true" />
        ปฏิทิน
      </Link>
    </div>
  );
}

/** Same size, before the URL is known (the page's static shell). */
export function ViewToggleFallback() {
  return (
    <div aria-hidden="true" className={GROUP}>
      <span className={off}>
        <List className="size-4" />
        ตาราง
      </span>
      <span className={off}>
        <CalendarDays className="size-4" />
        ปฏิทิน
      </span>
    </div>
  );
}
