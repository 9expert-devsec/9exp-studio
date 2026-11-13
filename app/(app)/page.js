import { Suspense } from "react";
import { LayoutGrid } from "lucide-react";
import { auth } from "@/auth";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { greetingFor } from "@/lib/format";

export const metadata = {
  title: "Dashboard · 9Expert Studio",
};

// Dashboard placeholder until real widgets exist. No fake numbers.
export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        section="Dashboard"
        title={
          <Suspense
            fallback={
              <span
                className="inline-block h-8 w-72 max-w-full animate-pulse rounded-[10px] bg-track align-middle"
                aria-hidden="true"
              />
            }
          >
            <Greeting />
          </Suspense>
        }
      >
        <p className="text-sm text-fg-muted">
          Here&apos;s what&apos;s happening with your media projects.
        </p>
      </PageHeader>

      <Card padded={false} className="flex flex-col items-center justify-center gap-3 border-dashed px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-brand-500">
          <LayoutGrid className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg text-fg">The dashboard is coming</h2>
        <p className="max-w-sm text-sm text-fg-muted">
          Project, task and review summaries will appear here once those modules are built.
        </p>
      </Card>
    </div>
  );
}

// Rendered inside the PageHeader <h1>.
async function Greeting() {
  const session = await auth();
  const name = session?.user?.name ?? "";
  // Read the clock after the session (request-time), in Asia/Bangkok.
  const greeting = greetingFor(new Date());
  return (
    <>
      {greeting}, {name} <span aria-hidden="true">👋</span>
    </>
  );
}
