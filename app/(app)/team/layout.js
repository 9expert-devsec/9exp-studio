import { Suspense } from "react";
import { notFound } from "next/navigation";
import TeamTabs from "@/components/team/TeamTabs";
import PageHeader from "@/components/ui/PageHeader";
import { getFullAccessUser } from "@/lib/team";

export const metadata = {
  title: "Team Management · 9Expert Studio",
};

// Full access only (superadmin or manager, lib/permissionRules.js). The gate (session + DB role re-read) sits inside <Suspense>, as
// cacheComponents requires; anyone else gets notFound(). Every page and every
// server action under /team checks again on its own, so this is not the only guard.
export default function TeamLayout({ children }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Suspense fallback={<TeamSkeleton />}>
        <FullAccessGate>{children}</FullAccessGate>
      </Suspense>
    </div>
  );
}

async function FullAccessGate({ children }) {
  if (!(await getFullAccessUser())) notFound();
  return (
    <>
      <PageHeader title="Team Management">
        <div className="mt-2">
          <TeamTabs />
        </div>
      </PageHeader>
      {children}
    </>
  );
}

function TeamSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <span className="h-8 w-64 max-w-full rounded-[10px] bg-track" />
      <span className="h-11 w-48 rounded-full bg-track" />
      <span className="h-64 rounded-[24px] bg-track" />
    </div>
  );
}
