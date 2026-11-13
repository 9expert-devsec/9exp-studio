// Server components that read the session. Each is rendered inside <Suspense>
// by app/(app)/layout.js (required under cacheComponents).

import { auth, signOut } from "@/auth";
import TeamNavLink from "./TeamNavLink";
import UserMenu from "./UserMenu";

// Display only: hides the link from non-superadmins. Access itself is enforced
// server-side by app/(app)/team/** (pages and actions re-read the role from the DB).
export async function TeamNavItem() {
  const session = await auth();
  if (session?.user?.role !== "superadmin") return null;
  return <TeamNavLink />;
}

export async function UserMenuSlot() {
  const session = await auth();
  const user = session?.user;
  if (!user) return null;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <UserMenu
      user={{ name: user.name ?? "", email: user.email ?? "", role: user.role ?? "" }}
      signOutAction={signOutAction}
    />
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex min-h-11 items-center gap-1.5 p-1 pr-2" aria-hidden="true">
      <span className="size-9 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
      <span className="h-3 w-4 rounded bg-slate-200 dark:bg-white/10" />
    </div>
  );
}
