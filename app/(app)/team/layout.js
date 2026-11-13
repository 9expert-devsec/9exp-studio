import { Suspense } from "react";
import { notFound } from "next/navigation";
import TeamTabs from "@/components/team/TeamTabs";
import { getSuperadmin } from "@/lib/team";

export const metadata = {
  title: "Team Management · 9Expert Studio",
};

// Superadmin only. The gate (session + DB role re-read) sits inside <Suspense>, as
// cacheComponents requires; anyone else gets notFound(). Every page and every
// server action under /team checks again on its own, so this is not the only guard.
export default function TeamLayout({ children }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Suspense fallback={<TeamSkeleton />}>
        <SuperadminGate>{children}</SuperadminGate>
      </Suspense>
    </div>
  );
}

async function SuperadminGate({ children }) {
  if (!(await getSuperadmin())) notFound();
  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl text-slate-900 dark:text-white sm:text-3xl">Team Management</h1>
        <TeamTabs />
      </div>
      {children}
    </>
  );
}

function TeamSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <span className="h-8 w-64 max-w-full rounded-lg bg-slate-200 dark:bg-white/10" />
      <span className="h-11 w-48 rounded-lg bg-slate-200 dark:bg-white/10" />
      <span className="h-64 rounded-2xl bg-slate-200 dark:bg-white/10" />
    </div>
  );
}
