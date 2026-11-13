"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import NavItem from "./NavItem";

// The ONLY places the shell reads the pathname. Under cacheComponents, usePathname()
// suspends on routes with unknown dynamic params (e.g. /projects/[id]), so AppShell
// renders these inside <Suspense> and the rest of the shell stays prerendered.

const isActive = (pathname, href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** Static fallback / building block: nav items with an explicit (or no) active path. */
export function NavItems({ items, pathname = "", onNavigate }) {
  return items.map((item) => (
    <NavItem
      key={item.label}
      item={item}
      active={!!pathname && !!item.href && isActive(pathname, item.href)}
      onNavigate={onNavigate}
    />
  ));
}

/** Nav items with the current route highlighted. */
export function ActiveNavItems({ items, onNavigate }) {
  const pathname = usePathname();
  return <NavItems items={items} pathname={pathname} onNavigate={onNavigate} />;
}

/** Calls `onRouteChange` whenever the pathname changes (closes the mobile drawer). */
export function RouteChangeEffect({ onRouteChange }) {
  const pathname = usePathname();
  useEffect(() => {
    onRouteChange();
  }, [pathname, onRouteChange]);
  return null;
}
