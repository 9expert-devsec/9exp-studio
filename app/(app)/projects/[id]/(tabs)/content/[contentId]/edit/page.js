import { Suspense } from "react";
import { notFound } from "next/navigation";
import ContentForm from "@/components/projects/ContentForm";
import { ContentFormSkeleton } from "@/components/projects/Skeletons";
import { loadContentForEdit, loadProjectContext } from "@/lib/projects/queries";

export const metadata = {
  title: "Edit content · 9Expert Studio",
};

// Admin, project owner or the item's creator, while the project is not cancelled.
// A contentId from another project (or one the viewer can't edit) → notFound().
// updateContentAction re-checks all of this.
export default function EditContentPage({ params }) {
  return (
    <Suspense fallback={<ContentFormSkeleton />}>
      <EditContent params={params} />
    </Suspense>
  );
}

async function EditContent({ params }) {
  const { id, contentId } = await params;
  const ctx = await loadProjectContext(id);
  const content = ctx ? await loadContentForEdit(ctx, contentId) : null;
  if (!content) notFound();

  const projectId = ctx.project._id.toString();
  return (
    <section aria-labelledby="content-form-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="content-form-heading" className="text-xl font-bold text-fg">Edit Content</h2>
        <p className="mt-1 text-sm text-fg-muted">Update this content item in {ctx.project.name}.</p>
      </div>
      <ContentForm
        mode="edit"
        projectId={projectId}
        cancelHref={`/projects/${projectId}`}
        initial={content}
        canDelete={content.canDelete}
      />
    </section>
  );
}
