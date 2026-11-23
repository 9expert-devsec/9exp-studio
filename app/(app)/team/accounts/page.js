import { Suspense } from "react";
import { notFound } from "next/navigation";
import AccountsManager from "./AccountsManager";
import TableSkeleton from "@/components/team/TableSkeleton";
import { getFullAccessUser, loadAccountsView } from "@/lib/team";

export const metadata = {
  title: "Accounts · Team Management · 9Expert Studio",
};

export default function AccountsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <AccountsData />
    </Suspense>
  );
}

async function AccountsData() {
  // Checked here too: layout and page render in parallel, so the page guards its own data.
  const me = await getFullAccessUser();
  if (!me) notFound();
  const { accounts, roles } = await loadAccountsView();
  // viewerRole drives the manager view (superadmin rows read-only, no superadmin
  // in the role pickers). UX only: every account action re-checks on the server.
  return <AccountsManager accounts={accounts} roles={roles} meId={me._id.toString()} viewerRole={me.role} />;
}
