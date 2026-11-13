import { Suspense } from "react";
import { notFound } from "next/navigation";
import AccountsManager from "./AccountsManager";
import TableSkeleton from "@/components/team/TableSkeleton";
import { getSuperadmin, loadAccountsView } from "@/lib/team";

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
  const me = await getSuperadmin();
  if (!me) notFound();
  const { accounts, roles } = await loadAccountsView();
  return <AccountsManager accounts={accounts} roles={roles} meId={me._id.toString()} />;
}
