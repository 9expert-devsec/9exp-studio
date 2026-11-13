import {
  Briefcase,
  ChartColumn,
  ClipboardCheck,
  FolderKanban,
  LayoutGrid,
  Library,
  ListChecks,
  Megaphone,
  Newspaper,
  Settings,
  Users,
} from "lucide-react";

// Sidebar menu, in Figma order. `href: null` = not built yet: rendered as a
// non-link item (aria-disabled, "Coming soon" tooltip), never a 404.
export const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutGrid },
  { label: "My Workspace", href: null, icon: Briefcase },
  { label: "Projects", href: null, icon: FolderKanban },
  { label: "All Tasks", href: null, icon: ListChecks },
  { label: "Review Queue", href: null, icon: ClipboardCheck },
  { label: "Content Library", href: null, icon: Library },
  { label: "Post Management", href: null, icon: Megaphone },
  { label: "Article Management", href: null, icon: Newspaper },
  { label: "Reports", href: null, icon: ChartColumn },
];

// Rendered only for superadmin (see TeamNavItem); active for any /team/* path.
export const TEAM_ITEM = {
  label: "Team Management",
  href: "/team/accounts",
  activePrefix: "/team",
  icon: Users,
};

export const ACCOUNT_ITEM = { label: "Account", href: "/account", icon: Settings };
