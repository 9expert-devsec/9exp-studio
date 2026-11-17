import { Suspense } from "react";
import { notFound } from "next/navigation";
import TableSkeleton from "@/components/team/TableSkeleton";
import RolesManager from "./RolesManager";
import { getSuperadmin, loadRolesView } from "@/lib/team";
import { PERMISSIONS } from "@/lib/permissions";
import { taskTypes } from "@/lib/tasks/types";

export const metadata = {
  title: "Roles · Team Management · 9Expert Studio",
};

export default function RolesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <RolesData />
    </Suspense>
  );
}

async function RolesData() {
  // Checked here too: layout and page render in parallel, so the page guards its own data.
  if (!(await getSuperadmin())) notFound();
  const roles = await loadRolesView();
  // Plain data for the client form (the catalog holds icon components).
  const taskTypeOptions = taskTypes().map((t) => ({ key: t.key, label: t.label, enabled: t.enabled }));
  return <RolesManager roles={roles} taskTypeOptions={taskTypeOptions} permissionOptions={PERMISSIONS} />;
}
