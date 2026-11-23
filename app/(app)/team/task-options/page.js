import { Suspense } from "react";
import { notFound } from "next/navigation";
import TableSkeleton from "@/components/team/TableSkeleton";
import { getFullAccessUser } from "@/lib/team";
import { PLATFORM_MARKS, TASK_OPTION_LISTS } from "@/lib/tasks/options";
import ExternalPerson from "@/models/ExternalPerson";
import Task from "@/models/Task";
import TaskOption from "@/models/TaskOption";
import ExternalPresentersManager from "./ExternalPresentersManager";
import { readMsdbSyncState } from "@/lib/msdbSync";
import { formatUpdatedAt } from "@/lib/projects/format";
import { loadFolderIdPanel } from "@/lib/tasks/folderCounter";
import FolderIdPanel from "./FolderIdPanel";
import MsdbSyncPanel from "./MsdbSyncPanel";
import TaskOptionsManager from "./TaskOptionsManager";

export const metadata = {
  title: "Task Options · Team Management · 9Expert Studio",
};

// Admin-managed task option lists (lib/tasks/options.js: Video Type · Platform ·
// Work Type · Article Type · Photo Type). Lives under Team
// Management because the shell has no separate settings/admin area.
// Full access only — superadmin or manager (the /team layout gates too; the page checks its own data).
export default function TaskOptionsPage({ searchParams }) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <TaskOptionsData searchParams={searchParams} />
    </Suspense>
  );
}

// Round 38: a tab that isn't a TaskOption list (its own model and manager).
const EXTERNAL_TAB = { key: "external_presenters", label: "External Presenters" };

async function TaskOptionsData({ searchParams }) {
  if (!(await getFullAccessUser())) notFound();
  const sp = await searchParams;
  if (sp?.list === EXTERNAL_TAB.key) return <ExternalPresentersData />;
  const listKey = TASK_OPTION_LISTS.some((l) => l.key === sp?.list) ? sp.list : TASK_OPTION_LISTS[0].key;

  const [options, usage, syncState, folderIds] = await Promise.all([
    TaskOption.find().sort({ order: 1, label: 1 }).lean(),
    // How many tasks reference each option (blocks delete).
    Task.aggregate([
      // Every option field a task can hold: clip videoType/platforms, graphic/post
      // platform/workType, article articleType, photo photoType.
      {
        $project: {
          ids: {
            $concatArrays: [
              ["$details.videoType", "$details.platform", "$details.workType", "$details.articleType", "$details.photoType"],
              { $ifNull: ["$details.platforms", []] },
            ],
          },
        },
      },
      { $unwind: "$ids" },
      { $match: { ids: { $ne: null } } },
      { $group: { _id: "$ids", n: { $sum: 1 } } },
    ]),
    readMsdbSyncState(),
    loadFolderIdPanel(),
  ]);
  const usedBy = new Map(usage.map((u) => [String(u._id), u.n]));

  // platform _id → how many work types link to it (blocks deleting the platform).
  const linkedBy = new Map();
  for (const o of options) {
    if (o.list !== "work_type") continue;
    for (const p of new Set((o.platforms ?? []).map(String))) linkedBy.set(p, (linkedBy.get(p) ?? 0) + 1);
  }

  const lists = Object.fromEntries(TASK_OPTION_LISTS.map((l) => [l.key, []]));
  for (const o of options) {
    const list = TASK_OPTION_LISTS.find((l) => l.key === o.list);
    if (!list) continue;
    const id = o._id.toString();
    lists[o.list].push({
      id,
      label: o.label,
      icon: o.icon ?? null,
      active: !!o.active,
      usedBy: usedBy.get(id) ?? 0,
      linkedBy: linkedBy.get(id) ?? 0,
      ...(list.hasPlatforms ? { platforms: [...new Set((o.platforms ?? []).map(String))] } : {}),
    });
  }

  // Work Type tab filter: ?platform=<platform option id> | "none"; anything else = All.
  const platformFilter =
    listKey === "work_type" && (sp?.platform === "none" || lists.platform.some((p) => p.id === sp?.platform)) ? sp.platform : null;

  return (
    <div className="flex flex-col gap-6">
      <TaskOptionsManager
        listKey={listKey}
        platformFilter={platformFilter}
        lists={TASK_OPTION_LISTS}
        extraTabs={[EXTERNAL_TAB]}
        options={lists}
        marks={PLATFORM_MARKS.map(({ key, label }) => ({ key, label }))}
      />
      <FolderIdPanel rows={folderIds} />
      <MsdbSyncPanel status={syncStatusView(syncState)} />
    </div>
  );
}

/** External Presenters tab: every saved person (name order) + how many tasks use them. */
async function ExternalPresentersData() {
  const [people, usage] = await Promise.all([
    ExternalPerson.find().sort({ name: 1 }).lean(),
    Task.aggregate([
      { $match: { "details.presenters.kind": "external" } },
      { $unwind: "$details.presenters" },
      { $match: { "details.presenters.kind": "external" } },
      { $group: { _id: "$details.presenters.id", tasks: { $addToSet: "$_id" } } },
      { $project: { n: { $size: "$tasks" } } },
    ]),
  ]);
  const usedBy = new Map(usage.map((u) => [String(u._id), u.n]));
  return (
    <ExternalPresentersManager
      tabs={[...TASK_OPTION_LISTS.map(({ key, label }) => ({ key, label })), EXTERNAL_TAB]}
      current={EXTERNAL_TAB.key}
      people={people.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        note: p.note ?? "",
        active: !!p.active,
        usedBy: usedBy.get(p._id.toString()) ?? 0,
      }))}
    />
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
