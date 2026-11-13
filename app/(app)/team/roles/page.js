import { Suspense } from "react";
import { notFound } from "next/navigation";
import TableSkeleton from "@/components/team/TableSkeleton";
import RolesManager from "./RolesManager";
import { getSuperadmin, loadRolesView } from "@/lib/team";

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
  return <RolesManager roles={roles} />;
}
