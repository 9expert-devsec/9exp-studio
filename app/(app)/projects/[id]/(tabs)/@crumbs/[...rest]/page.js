import ProjectCrumbs from "@/components/projects/ProjectCrumbs";

// @crumbs slot for every nested (tabs) route (overview, content/new,
// content/[contentId], content/[contentId]/edit); params.rest = those segments.
export default function CrumbsNested({ params }) {
  return <ProjectCrumbs params={params} />;
}
