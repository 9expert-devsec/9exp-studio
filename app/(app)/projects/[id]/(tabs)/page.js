import { Suspense } from "react";
import { notFound } from "next/navigation";
import ContentToolbar from "@/components/projects/ContentToolbar";
import { ContentCard, NoContent, NoContentMatches } from "@/components/projects/ContentViews";
import { ContentListSkeleton } from "@/components/projects/Skeletons";
import { parseContentFilters } from "@/lib/projects/filters";
import { loadContentList, loadProjectContext } from "@/lib/projects/queries";

export const metadata = {
  title: "Project · 9Expert Studio",
};

// Content tab (the default tab of a project). ?q= and ?status= are parsed from
// searchParams on every render; params/searchParams/session read inside <Suspense>.
export default function ProjectContentPage({ params, searchParams }) {
  return (
    <Suspense fallback={<ContentListSkeleton />}>
      <ContentTab params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ContentTab({ params, searchParams }) {
  const { id } = await params;
  const ctx = await loadProjectContext(id);
  if (!ctx) notFound();

  const filters = parseContentFilters(await searchParams);
  const { total, items, canAdd } = await loadContentList(ctx, filters);
  const href = `/projects/${ctx.project._id}`;
  const addHref = canAdd ? `${href}/content/new` : null;

  return (
    <section aria-labelledby="content-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 id="content-heading" className="text-xl font-bold text-fg">Content</h2>
            <span className="rounded-full bg-track px-2.5 py-0.5 text-xs font-medium text-fg-muted">
              {items.length} {items.length === 1 ? "content" : "contents"}
            </span>
          </div>
          <p className="mt-1 text-sm text-fg-muted">Manage briefs and tasks for each deliverable.</p>
        </div>
        <ContentToolbar basePath={href} q={filters.q} status={filters.status} addHref={addHref} />
      </div>

      {total === 0 ? (
        <NoContent addHref={addHref} />
      ) : items.length === 0 ? (
        <NoContentMatches clearHref={href} />
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((c) => (
            <li key={c.id}>
              <ContentCard content={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
