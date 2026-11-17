import { Suspense } from "react";
import { notFound } from "next/navigation";
import TableSkeleton from "@/components/team/TableSkeleton";
import { getSuperadmin } from "@/lib/team";
import { PLATFORM_MARKS, TASK_OPTION_LISTS } from "@/lib/tasks/options";
import Task from "@/models/Task";
import TaskOption from "@/models/TaskOption";
import { readMsdbSyncState } from "@/lib/msdbSync";
import { formatUpdatedAt } from "@/lib/projects/format";
import MsdbSyncPanel from "./MsdbSyncPanel";
import TaskOptionsManager from "./TaskOptionsManager";

export const metadata = {
  title: "Task Options · Team Management · 9Expert Studio",
};

// Admin-managed task option lists (Video Type · Platform). Lives under Team
// Management because the shell has no separate settings/admin area.
// Superadmin only (the /team layout gates too; the page checks its own data).
export default function TaskOptionsPage({ searchParams }) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <TaskOptionsData searchParams={searchParams} />
    </Suspense>
  );
}

async function TaskOptionsData({ searchParams }) {
  if (!(await getSuperadmin())) notFound();
  const sp = await searchParams;
  const listKey = TASK_OPTION_LISTS.some((l) => l.key === sp?.list) ? sp.list : TASK_OPTION_LISTS[0].key;

  const [options, usage, syncState] = await Promise.all([
    TaskOption.find().sort({ order: 1, label: 1 }).lean(),
    // How many tasks reference each option (blocks delete).
    Task.aggregate([
      { $project: { ids: { $concatArrays: [["$details.videoType"], { $ifNull: ["$details.platforms", []] }] } } },
      { $unwind: "$ids" },
      { $match: { ids: { $ne: null } } },
      { $group: { _id: "$ids", n: { $sum: 1 } } },
    ]),
    readMsdbSyncState(),
  ]);
  const usedBy = new Map(usage.map((u) => [String(u._id), u.n]));

  const lists = Object.fromEntries(TASK_OPTION_LISTS.map((l) => [l.key, []]));
  for (const o of options) {
    lists[o.list]?.push({
      id: o._id.toString(),
      label: o.label,
      icon: o.icon ?? null,
      active: !!o.active,
      usedBy: usedBy.get(o._id.toString()) ?? 0,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <TaskOptionsManager
        listKey={listKey}
        lists={TASK_OPTION_LISTS}
        options={lists}
        marks={PLATFORM_MARKS.map(({ key, label }) => ({ key, label }))}
      />
      <MsdbSyncPanel status={syncStatusView(syncState)} />
    </div>
  );
}

const COUNT_LABELS = [
  ["public_course", "public courses"],
  ["online_course", "online courses"],
  ["program", "programs"],
  ["skill", "skills"],
];
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "5 minutes ago", "yesterday", … */
function relativeTime(value) {
  const secs = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const steps = [
    [60, "second"],
    [3600, "minute", 60],
    [86400, "hour", 3600],
    [Infinity, "day", 86400],
  ];
  for (const [limit, unit, div = 1] of steps) {
    if (Math.abs(secs) < limit) return relative.format(Math.round(secs / div), unit);
  }
  return "";
}

/** The MSDB mirror sync status → plain labels for the panel. */
function syncStatusView(state) {
  const counts = state?.counts ?? {};
  return {
    lastSynced: state?.lastSuccessAt ? relativeTime(state.lastSuccessAt) : null,
    lastSyncedTitle: state?.lastSuccessAt ? formatUpdatedAt(state.lastSuccessAt) : null,
    counts: COUNT_LABELS.filter(([k]) => typeof counts[k]?.active === "number")
      .map(([k, label]) => `${counts[k].active} ${label}`)
      .join(" · "),
    lastError: state?.lastError ?? null,
  };
}
