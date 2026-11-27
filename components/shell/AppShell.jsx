"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Bell, Menu, Search, Settings, X } from "lucide-react";
import StudioLogo from "@/components/brand/StudioLogo";
import IconButton from "@/components/ui/IconButton";
import { ActiveNavItems, NavItems, RouteChangeEffect } from "./PathnameBits";
import ThemeToggle from "./ThemeToggle";
import { ACCOUNT_ITEM, NAV_ITEMS } from "./nav";

// App shell from the confirmed Figma frames (Projects · Light 40:6 / · Dark 39:6).
//
// Desktop (lg+): floating navy panel, fixed 16px from top/left/bottom, 260 wide,
// radius 22, nav-border + nav-shadow. The main column starts at 16+260+16 = 292px.
// Below lg the same panel is an off-canvas drawer (hamburger, Escape, backdrop,
// close on route change, scroll lock, focus in/out).
//
// Session-dependent parts arrive as server-rendered slots wrapped in <Suspense>
// by app/(app)/layout.js: `teamSlot` (Team Management, superadmin only) and
// `userMenuSlot` (account pill + dropdown).
//
// The pathname is read only inside <Suspense> (components/shell/PathnameBits.jsx):
// on dynamic routes like /projects/[id] it is request-time data under cacheComponents.
//
// Pinned pages (round 52): a page whose content carries `data-pinned-shell` (the
// project layout) turns the shell into a full-height column on lg+ — the window
// never scrolls, the top bar and the page's own header stay put, and the page
// scrolls inside its own container (lg:has-[[data-pinned-shell]]:… below). Every other page keeps
// normal window scrolling; below lg everything scrolls the window as before.

const ACCOUNT_ITEMS = [ACCOUNT_ITEM];

export default function AppShell({ children, teamSlot, userMenuSlot }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

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
        if (e.key === "Escape") setOpen(false);
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
    <div className="flex min-h-dvh flex-1 bg-page text-fg dark:[color-scheme:dark] lg:has-[[data-pinned-shell]]:h-dvh lg:has-[[data-pinned-shell]]:overflow-hidden">
      {/* Close the drawer on any route change (link, back/forward). */}
      <Suspense fallback={null}>
        <RouteChangeEffect onRouteChange={close} />
      </Suspense>

      {/* Backdrop (mobile drawer only) */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Floating navbar: navy in both themes. */}
      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={`fixed bottom-4 left-4 top-4 z-40 flex w-[260px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[22px] border border-nav-border bg-nav-bg shadow-nav transition-[transform,visibility] duration-200 lg:visible lg:translate-x-0 ${
          open ? "visible translate-x-0" : "invisible -translate-x-[calc(100%+16px)]"
        }`}
      >
        <div className="relative flex shrink-0 justify-center px-5 py-2.5">
          <StudioLogo size="nav" />
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-nav-fg hover:bg-white/[0.04] hover:text-nav-fg-active focus-visible:outline-2 focus-visible:outline-brand-500 lg:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <ul className="flex flex-col gap-1">
            <Suspense fallback={<NavItems items={NAV_ITEMS} onNavigate={close} />}>
              <ActiveNavItems items={NAV_ITEMS} onNavigate={close} />
            </Suspense>
            {teamSlot}
          </ul>
          <hr className="mt-3 border-0 border-t border-nav-divider" />
          <ul className="mt-3 flex flex-col gap-1">
            <Suspense fallback={<NavItems items={ACCOUNT_ITEMS} onNavigate={close} />}>
              <ActiveNavItems items={ACCOUNT_ITEMS} onNavigate={close} />
            </Suspense>
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[292px] lg:has-[[data-pinned-shell]]:min-h-0">
        <header className="sticky top-0 z-20 bg-page/90 px-4 pt-4 backdrop-blur sm:px-[26px]">
          <div className="flex h-10 items-center gap-3">
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-controls="app-sidebar"
              aria-expanded={open}
              className="-ml-2 flex size-11 items-center justify-center rounded-xl text-fg hover:bg-control focus-visible:outline-2 focus-visible:outline-brand-500 lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            <div className="ml-auto flex items-center gap-1.5">
              <IconButton icon={Search} label="Search" title="Search is coming soon" disabled />
              <IconButton icon={Bell} label="Notifications" title="Notifications are coming soon" disabled />
              <IconButton icon={Settings} label="Account settings" href="/account" />
              <ThemeToggle />
              {userMenuSlot}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[26px] pt-[22px] sm:px-[26px] lg:has-[[data-pinned-shell]]:flex lg:has-[[data-pinned-shell]]:min-h-0 lg:has-[[data-pinned-shell]]:flex-col lg:has-[[data-pinned-shell]]:pb-0">{children}</main>
      </div>
    </div>
  );
}
