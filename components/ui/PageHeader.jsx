import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Page header used by every (app) page:
//   breadcrumb "9Expert Studio / {section}" (12px, muted; Figma 10px, raised for legibility)
//   then, ~10px below: [back chevron] title (28px bold) ............ [actions]
// The ~22px gap above the breadcrumb comes from the shell's <main> padding.
export default function PageHeader({ section, title, backHref, actions, children }) {
  return (
    <div className="flex flex-col gap-2.5">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-fg-muted">
          <li>9Expert Studio</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{section}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        {backHref && (
          <Link
            href={backHref}
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
