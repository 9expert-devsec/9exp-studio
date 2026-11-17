"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Accounts", href: "/team/accounts" },
  { label: "Roles", href: "/team/roles" },
  { label: "Task Options", href: "/team/task-options" },
];

// Figma view-switcher style: `control` pill track; the selected tab is brand-500 with navy text.
export default function TeamTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Team Management sections">
      <ul className="inline-flex gap-1 rounded-full border border-control-line bg-control p-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  active ? "bg-brand-500 text-navy" : "text-fg-muted hover:text-fg"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
