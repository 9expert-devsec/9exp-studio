// Suspense fallbacks for the project pages.

import PageHeader from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Chip, TILE } from "./ProjectBits";
import {
  HEADER_ACTIONS,
  HEADER_CARD_PAD,
  HEADER_LABEL,
  HEADER_LEFT,
  HEADER_META,
  HEADER_NAME,
  HEADER_ROW,
  HEADER_TEXT,
  TAB_BASE,
  TAB_IDLE_COLOR,
  TAB_LIST,
  TAB_NAV,
} from "./projectTopStyles";

export function FormSkeleton() {
  return <div className="mx-auto h-[720px] w-full max-w-[880px] animate-pulse rounded-[24px] bg-track" aria-hidden="true" />;
}

/**
 * Round 55 — first entry into a project: the (tabs) layout's ONE boundary covers
 * breadcrumb + header card + tabs, and this fallback renders the same three rows
 * with the SAME components / class constants (projectTopStyles) as the real ones,
 * so every row has the real height. Placeholder text is kept in the flow but
 * `invisible` / `text-transparent`, so line boxes match the real text exactly.
 * Returns a fragment: the rows are the layout's `flex-col gap-6` children, like
 * the real ones.
 */
export function ProjectTopSkeleton() {
  return (
    <>
      <div aria-hidden="true" className="animate-pulse">
        <PageHeader
          breadcrumb={[
            { label: "Projects", href: "/projects" },
            { label: <span className="inline-block h-3 w-40 rounded bg-track align-middle" /> },
          ]}
        />
      </div>
      <div aria-hidden="true" className={`${cardClass({ padded: false })} ${HEADER_CARD_PAD} animate-pulse`}>
        <div className={HEADER_ROW}>
          <div className={HEADER_LEFT}>
            <span className={`shrink-0 bg-track ${TILE.lg.box}`} />
            <div className={HEADER_TEXT}>
              <p className={HEADER_LABEL}>Project name</p>
              <p className={HEADER_NAME}>
                <span className="rounded-md bg-track text-transparent">Loading project name</span>
              </p>
              <div className={HEADER_META}>
                <Chip>
                  <span className="invisible">Project type</span>
                </Chip>
                <Chip>
                  <span className="invisible">Status</span>
                </Chip>
              </div>
            </div>
          </div>
          <div className={HEADER_ACTIONS}>
            <span className={buttonClass("secondary")}>
              <span className="invisible">Share</span>
            </span>
          </div>
        </div>
      </div>
      <nav aria-hidden="true" className={TAB_NAV}>
        <ul className={TAB_LIST}>
          {["Content", "Timeline", "Overview"].map((t) => (
            <li key={t}>
              <span className={`${TAB_BASE} ${TAB_IDLE_COLOR}`}>{t}</span>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-3" aria-hidden="true">
      <span className="h-72 rounded-[24px] bg-track lg:col-span-2" />
      <span className="h-72 rounded-[24px] bg-track" />
    </div>
  );
}

export function ContentListSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <span className="h-12 w-72 rounded bg-track" />
      {[0, 1].map((i) => (
        <span key={i} className="h-64 rounded-[16px] bg-track" />
      ))}
    </div>
  );
}

export function ContentFormSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <span className="h-12 w-72 rounded bg-track" />
      <span className="h-[460px] rounded-[24px] bg-track" />
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <span className="h-11 w-full max-w-xl rounded bg-track" />
      <span className="h-[420px] rounded-[16px] bg-track" />
    </div>
  );
}
