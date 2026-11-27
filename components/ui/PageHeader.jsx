import { Fragment } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Page header used by every (app) page.
 *
 * Top-level menu pages (Dashboard, Account, Team Management and its tabs) pass NO
 * breadcrumb: only the title row renders. Nested pages pass a trail that starts at
 * the MENU name (linked) and ends with the current page (not linked); a back
 * chevron then appears, linking to the parent crumb.
 *
 * Back target (round 52) — derived from the trail itself, always a real link
 * (never history back): the nearest LINKED crumb above the current page. A last
 * crumb marked `tab: true` (e.g. "Content" / "Overview" / "Timeline" on a project)
 * is a tab OF the crumb before it, so the current page is that crumb and back
 * goes one level higher (Projects / <project> / Content → /projects).
 *
 * @example
 * // A future project detail page: "Projects / JavaScript Essentials"
 * <PageHeader
 *   breadcrumb={[
 *     { label: "Projects", href: "/projects" },
 *     { label: project.name },
 *   ]}
 *   title={project.name}
 *   actions={<Button icon={Plus}>Create content</Button>}
 * />
 *
 * @param {{
 *   title?: React.ReactNode,  // omit when the page renders its own <h1> (detail header card)
 *   breadcrumb?: { label: string, href?: string, tab?: boolean }[],
 *   actions?: React.ReactNode,
 *   children?: React.ReactNode,
 * }} props
 */
export default function PageHeader({ title, breadcrumb, actions, children }) {
  const trail = Array.isArray(breadcrumb) && breadcrumb.length > 0 ? breadcrumb : null;
  // Back goes to the nearest linked crumb above the current page (a trailing tab
  // crumb belongs to the page before it).
  const pageIndex = trail ? trail.length - 1 - (trail.at(-1)?.tab ? 1 : 0) : 0;
  const parentHref = trail
    ? trail
        .slice(0, pageIndex)
        .reverse()
        .find((c) => c.href)?.href
    : undefined;

  const backLink = parentHref && (
    <Link
      href={parentHref}
      aria-label="Back"
      className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-fg hover:bg-control focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <ChevronLeft className="size-[17px]" aria-hidden="true" />
    </Link>
  );
  // No title (e.g. a detail page whose own header card holds the <h1>): render just
  // the breadcrumb line, with the back chevron inline before it.
  const hasTitleRow = !!title || !!actions;

  return (
    <div className="flex flex-col gap-2.5">
      {trail && (
        <nav aria-label="Breadcrumb" className={hasTitleRow ? "" : "flex items-center gap-2"}>
          {!hasTitleRow && backLink}
          <ol className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
            {trail.map((crumb, i) => {
              const last = i === trail.length - 1;
              return (
                <Fragment key={`${i}-${crumb.label}`}>
                  {i > 0 && <li aria-hidden="true">/</li>}
                  <li aria-current={last ? "page" : undefined}>
                    {!last && crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="rounded hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      crumb.label
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </nav>
      )}

      {hasTitleRow && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          {backLink}
          {title && (
            <h1 className="min-w-0 flex-1 text-[27px] font-bold leading-tight text-fg sm:text-[28px]">{title}</h1>
          )}
          {actions && <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}

      {children}
    </div>
  );
}
