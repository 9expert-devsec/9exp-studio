import ProjectCrumbs from "@/components/projects/ProjectCrumbs";

// @crumbs slot at /projects/[id] (Content tab).
export default function CrumbsRoot({ params }) {
  return <ProjectCrumbs params={params} />;
}
