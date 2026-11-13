import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProjectForm from "@/components/projects/ProjectForm";
import { FormSkeleton } from "@/components/projects/Skeletons";
import PageHeader from "@/components/ui/PageHeader";
import { getProjectViewer } from "@/lib/projects/access";
import { loadProjectForEdit } from "@/lib/projects/queries";

export const metadata = {
  title: "Edit project · 9Expert Studio",
};

// Owner/admin only; anyone else (or a missing project) → notFound().
// params is request-time data (no generateStaticParams), read inside <Suspense>.
export default function EditProjectPage({ params }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Suspense fallback={<FormSkeleton />}>
        <EditProject params={params} />
      </Suspense>
    </div>
  );
}

async function EditProject({ params }) {
  const { id } = await params;
  const viewer = await getProjectViewer();
  const project = viewer ? await loadProjectForEdit(viewer, id) : null;
  if (!project) notFound();

  const href = `/projects/${project.id}`;
  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Projects", href: "/projects" },
          { label: project.name, href },
          { label: "Edit" },
        ]}
        title="Edit project"
      />
      <ProjectForm mode="edit" cancelHref={href} initial={project} />
    </>
  );
}
