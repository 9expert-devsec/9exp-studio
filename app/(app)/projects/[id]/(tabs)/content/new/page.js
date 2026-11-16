import { Suspense } from "react";
import { notFound } from "next/navigation";
import ContentForm from "@/components/projects/ContentForm";
import { ContentFormSkeleton } from "@/components/projects/Skeletons";
import { canAddContent } from "@/lib/projects/access";
import { loadProjectContext } from "@/lib/projects/queries";

export const metadata = {
  title: "Create content · 9Expert Studio",
};

// Anyone who can view the project, while it is not cancelled; otherwise notFound().
// createContentAction re-checks all of this.
export default function NewContentPage({ params }) {
  return (
    <Suspense fallback={<ContentFormSkeleton />}>
      <NewContent params={params} />
    </Suspense>
  );
}

async function NewContent({ params }) {
  const { id } = await params;
  const ctx = await loadProjectContext(id);
  if (!ctx || !canAddContent(ctx.viewer, ctx.project)) notFound();

  const projectId = ctx.project._id.toString();
  return (
    <section aria-labelledby="content-form-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="content-form-heading" className="text-xl font-bold text-fg">Create Content</h2>
        <p className="mt-1 text-sm text-fg-muted">Add a new content item to {ctx.project.name}.</p>
      </div>
      <ContentForm
        mode="create"
        projectId={projectId}
        cancelHref={`/projects/${projectId}`}
        initial={{ name: "", description: "", briefLink: "" }}
      />
    </section>
  );
}
