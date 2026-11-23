// Server components that read the session. Each is rendered inside <Suspense>
// by app/(app)/layout.js (required under cacheComponents).

import mongoose from "mongoose";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { isFullAccess } from "@/lib/permissionRules";
import { signOutAction } from "@/lib/session-actions";
import Role from "@/models/Role";
import User from "@/models/User";
import TeamNavLink from "./TeamNavLink";
import UserMenu from "./UserMenu";

// Display only: hides the link from anyone without full access (superadmin or
// manager). Access itself is enforced server-side by app/(app)/team/** (pages and
// actions re-read the role from the DB).
export async function TeamNavItem() {
  const session = await auth();
  if (!isFullAccess(session?.user)) return null;
  return <TeamNavLink />;
}

// Display data read from the DB (not the JWT): the role's name ("Super Admin", not
// "superadmin") and the avatar URL. Falls back to the key / initials if a doc is
// missing or the DB is unreachable.
async function pillDataFor(userId, roleKey) {
  const fallback = { roleName: roleKey ?? "", avatarUrl: null };
  try {
    await dbConnect();
    const [role, me] = await Promise.all([
      roleKey ? Role.findOne({ key: roleKey }).select("name").lean() : null,
      userId && mongoose.isValidObjectId(userId)
        ? User.findById(userId).select("avatar.url").lean()
        : null,
    ]);
    return { roleName: role?.name ?? fallback.roleName, avatarUrl: me?.avatar?.url ?? null };
  } catch {
    return fallback;
  }
}

export async function UserMenuSlot() {
  const session = await auth();
  const user = session?.user;
  if (!user) return null;

  const { roleName, avatarUrl } = await pillDataFor(user.id, user.role);

  return (
    <UserMenu
      user={{ name: user.name ?? "", email: user.email ?? "", roleName, avatarUrl }}
      signOutAction={signOutAction}
    />
  );
}

export function UserMenuSkeleton() {
  return (
    <div
      className="flex h-[34px] items-center gap-2 rounded-[18px] border border-control-line bg-control p-1 pr-2"
      aria-hidden="true"
    >
      <span className="size-6 animate-pulse rounded-[10px] bg-track" />
      <span className="hidden h-3 w-16 animate-pulse rounded bg-track sm:block" />
    </div>
  );
}
