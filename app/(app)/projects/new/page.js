import { Suspense } from "react";
import { redirect } from "next/navigation";
import ProjectForm from "@/components/projects/ProjectForm";
import { FormSkeleton } from "@/components/projects/Skeletons";
import PageHeader from "@/components/ui/PageHeader";
import { canCreate, getProjectViewer } from "@/lib/projects/access";
import { viewerAsOwner } from "@/lib/projects/queries";

export const metadata = {
  title: "New project · 9Expert Studio",
};

export default function NewProjectPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: "Projects", href: "/projects" }, { label: "New project" }]}
        title="New project"
      />
      <Suspense fallback={<FormSkeleton />}>
        <NewProjectForm />
      </Suspense>
    </div>
  );
}

async function NewProjectForm() {
  const viewer = await getProjectViewer();
  if (!canCreate(viewer)) redirect("/login");

  return (
    <ProjectForm
      mode="create"
      cancelHref="/projects"
      initial={{ owner: viewerAsOwner(viewer), members: [] }}
    />
  );
}
