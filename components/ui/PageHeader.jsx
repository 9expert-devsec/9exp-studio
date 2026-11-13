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
 *   title: React.ReactNode,
 *   breadcrumb?: { label: string, href?: string }[],
 *   actions?: React.ReactNode,
 *   children?: React.ReactNode,
 * }} props
 */
export default function PageHeader({ title, breadcrumb, actions, children }) {
  const trail = Array.isArray(breadcrumb) && breadcrumb.length > 0 ? breadcrumb : null;
  // Back goes to the nearest linked crumb above the current page.
  const parentHref = trail
    ? trail
        .slice(0, -1)
        .reverse()
        .find((c) => c.href)?.href
    : undefined;

  return (
    <div className="flex flex-col gap-2.5">
      {trail && (
        <nav aria-label="Breadcrumb">
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        {parentHref && (
          <Link
            href={parentHref}
            aria-label="Back"
            className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-fg hover:bg-control focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ChevronLeft className="size-[17px]" aria-hidden="true" />
          </Link>
        )}
        <h1 className="min-w-0 flex-1 text-[27px] font-bold leading-tight text-fg sm:text-[28px]">{title}</h1>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children}
    </div>
  );
}
