import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { auth } from "@/auth";
import { greetingFor } from "@/lib/format";

export const metadata = {
  title: "Dashboard · 9Expert Studio",
};

// Dashboard placeholder until real widgets exist. No fake numbers.
export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Suspense
          fallback={
            <div
              className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-slate-200 dark:bg-white/10"
              aria-hidden="true"
            />
          }
        >
          <Greeting />
        </Suspense>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Here&apos;s what&apos;s happening with your media projects.
        </p>
      </div>

      <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-white/15 dark:bg-surface-dark">
        <span className="flex size-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
          <LayoutDashboard className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg text-slate-900 dark:text-white">The dashboard is coming</h2>
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
          Project, task and review summaries will appear here once those modules are built.
        </p>
      </section>
    </div>
  );
}

async function Greeting() {
  const session = await auth();
  const name = session?.user?.name ?? "";
  // Read the clock after the session (request-time), in Asia/Bangkok.
  const greeting = greetingFor(new Date());
  return (
    <h1 className="text-2xl text-slate-900 dark:text-white sm:text-3xl">
      {greeting}, {name} <span aria-hidden="true">👋</span>
    </h1>
  );
}
