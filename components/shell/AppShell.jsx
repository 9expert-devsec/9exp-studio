"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, X } from "lucide-react";
import StudioLogo from "@/components/brand/StudioLogo";
import NavItem from "./NavItem";
import ThemeToggle from "./ThemeToggle";
import { ACCOUNT_ITEM, NAV_ITEMS } from "./nav";

// INTERIM shell (from the mockup) until the Figma UI arrives. Keep styling in
// classes here so it is easy to restyle.
//
// Session-dependent parts arrive as server-rendered slots wrapped in <Suspense>
// by app/(app)/layout.js: `teamSlot` (Team Management, superadmin only) and
// `userMenuSlot` (avatar + dropdown).

const isActive = (pathname, href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export default function AppShell({ children, teamSlot, userMenuSlot }) {
  const pathname = usePathname();
  // The drawer is "open for a given path": navigating anywhere closes it without an effect.
  const [openPath, setOpenPath] = useState(null);
  const open = openPath === pathname;
  const close = () => setOpenPath(null);

  const hamburgerRef = useRef(null);
  const closeRef = useRef(null);
  const wasOpen = useRef(false);

  // Escape to close, body scroll lock, and focus in/out of the drawer.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e) => {
        if (e.key === "Escape") setOpenPath(null);
      };
      document.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = prevOverflow;
        document.removeEventListener("keydown", onKey);
      };
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      hamburgerRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="flex min-h-dvh flex-1 bg-[#F8FAFC] text-slate-900 dark:bg-navy dark:text-white dark:[color-scheme:dark]">
      {/* Backdrop (mobile drawer only) */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Sidebar: fixed on lg+, off-canvas drawer below. Navy in both themes. */}
      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/10 bg-navy text-white transition-[transform,visibility] duration-200 lg:visible lg:translate-x-0 ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <StudioLogo size="sm" />
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="flex size-11 items-center justify-center rounded-lg text-white/70 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-500 lg:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                active={item.href ? isActive(pathname, item.href) : false}
                onNavigate={close}
              />
            ))}
            {teamSlot}
          </ul>
          <hr className="my-3 border-white/10" />
          <ul className="flex flex-col gap-1">
            <NavItem
              item={ACCOUNT_ITEM}
              active={isActive(pathname, ACCOUNT_ITEM.href)}
              onNavigate={close}
            />
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-navy/90 sm:px-6">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setOpenPath(pathname)}
            aria-label="Open menu"
            aria-controls="app-sidebar"
            aria-expanded={open}
            className="flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-300 dark:hover:bg-white/5 lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          {/* Search: visual only for now. */}
          <div className="relative hidden min-w-0 max-w-md flex-1 sm:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="app-search" className="sr-only">
              Search
            </label>
            <input
              id="app-search"
              type="search"
              disabled
              aria-disabled="true"
              title="Search is coming soon"
              placeholder="Search projects, assets, or tasks…"
              className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-base text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white sm:text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label="Notifications"
              title="Notifications are coming soon"
              className="flex size-11 cursor-not-allowed items-center justify-center rounded-lg text-slate-400 dark:text-slate-500"
            >
              <Bell className="size-5" aria-hidden="true" />
            </button>
            <ThemeToggle />
            {userMenuSlot}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
