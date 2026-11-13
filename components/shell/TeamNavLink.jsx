"use client";

import { usePathname } from "next/navigation";
import NavItem from "./NavItem";
import { TEAM_ITEM } from "./nav";

// Client wrapper so Team Management can show its active state for any /team/* path.
// Rendered by the server-side TeamNavItem only for superadmin.
export default function TeamNavLink() {
  const pathname = usePathname();
  const active = pathname === TEAM_ITEM.activePrefix || pathname.startsWith(`${TEAM_ITEM.activePrefix}/`);
  return <NavItem item={TEAM_ITEM} active={active} />;
}
