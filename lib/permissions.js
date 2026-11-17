// Role permissions: THE one place these checks live. Server only.
//
// A user's role is read from the DB (users store the role KEY). Rules:
//   - Superadmin always passes every check.
//   - A setting that was never saved (null / missing) = NOT configured =
//     unrestricted, so nothing breaks before roles are configured.
//   - Once saved (even as an empty list) it restricts to what is listed.
//   - An unknown role key (role deleted) behaves like an unconfigured role.
// Settings (models/Role.js): `taskTypes`, and `permissions` (+ its
// permissionsConfiguredAt marker, because legacy roles were seeded with []).

import "server-only";
import { cache } from "react";
import { SUPERADMIN } from "@/lib/team";
import Role from "@/models/Role";

/** The generic permission keys this round (labels for the Roles form). */
export const PERMISSIONS = [
  { key: "review_content", label: "Content review" },
  { key: "review_video", label: "Video review" },
];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/** One lookup per role key per request. */
const roleByKey = cache(async (key) => {
  if (!key || key === SUPERADMIN) return null;
  return Role.findOne({ key }).select("key taskTypes permissions permissionsConfiguredAt").lean();
});

export const isSuperadmin = (user) => user?.role === SUPERADMIN;

/** Pure rule on a role doc (null = unconfigured). */
export const roleDocWorksOnType = (role, type) => !Array.isArray(role?.taskTypes) || role.taskTypes.includes(type);
export const roleDocHasPermission = (role, key) =>
  !role?.permissionsConfiguredAt || !Array.isArray(role.permissions) || role.permissions.includes(key);

/**
 * Does this user's role work on `type`? (Type enablement is checked separately by
 * the catalog: a disabled type is never creatable.)
 * @param {{ role?: string } | null} user  a User doc (or the viewer's `user`)
 */
export async function roleWorksOnType(user, type) {
  if (!user) return false;
  if (isSuperadmin(user)) return true;
  return roleDocWorksOnType(await roleByKey(user.role), type);
}

/** Does this user's role grant permission `key` (e.g. "review_content")? */
export async function hasPermission(user, key) {
  if (!user) return false;
  if (isSuperadmin(user)) return true;
  return roleDocHasPermission(await roleByKey(user.role), key);
}
