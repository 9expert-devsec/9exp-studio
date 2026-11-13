"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Accounts", href: "/team/accounts" },
  { label: "Roles", href: "/team/roles" },
];

export default function TeamTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Team Management sections" className="border-b border-slate-200 dark:border-white/10">
      <ul className="-mb-px flex gap-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  active
                    ? "border-brand-500 text-slate-900 dark:text-white"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
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
