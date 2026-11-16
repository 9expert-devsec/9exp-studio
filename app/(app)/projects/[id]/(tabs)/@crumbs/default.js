// Fallback for the @crumbs slot (page.js + [...rest]/page.js match every route
// under /projects/[id]/(tabs), so this should not normally render).
export default function CrumbsDefault() {
  return null;
}
