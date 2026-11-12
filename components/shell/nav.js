import {
  BarChart3,
  Briefcase,
  ClipboardCheck,
  FolderKanban,
  LayoutDashboard,
  Library,
  ListChecks,
  Megaphone,
  Newspaper,
  Settings,
  Users,
} from "lucide-react";

// Sidebar menu, in spec order. `href: null` = not built yet (rendered as "Soon").
export const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "My Workspace", href: null, icon: Briefcase },
  { label: "Projects", href: null, icon: FolderKanban },
  { label: "All Tasks", href: null, icon: ListChecks },
  { label: "Review Queue", href: null, icon: ClipboardCheck },
  { label: "Content Library", href: null, icon: Library },
  { label: "Post Management", href: null, icon: Megaphone },
  { label: "Article Management", href: null, icon: Newspaper },
  { label: "Reports", href: null, icon: BarChart3 },
];

// Rendered only for superadmin (see TeamNavItem).
export const TEAM_ITEM = { label: "Team Management", href: null, icon: Users };

export const ACCOUNT_ITEM = { label: "Account", href: "/account", icon: Settings };
