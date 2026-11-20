import Link from "next/link";

const BASE = "/team/task-options";

/**
 * Task Options tabs (?list=): every option list + External Presenters (round 38).
 * @param {{ tabs: { key: string, label: string }[], current: string }} props
 */
export default function OptionTabs({ tabs, current }) {
  return (
    <nav aria-label="Option lists" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="inline-flex gap-1 whitespace-nowrap rounded-full border border-control-line bg-control p-1">
        {tabs.map((l) => (
          <li key={l.key}>
            <Link
              href={`${BASE}?list=${l.key}`}
              scroll={false}
              aria-current={l.key === current ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                l.key === current ? "bg-brand-500 text-navy" : "text-fg-muted hover:text-fg"
              }`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
