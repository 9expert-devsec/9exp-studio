// Role permissions: THE one place these checks live. Server only.
//
// A user's role is read from the DB (users store the role KEY). Rules:
//   - Full access (superadmin + manager, by role KEY — lib/permissionRules.js
//     isFullAccess) always passes every check; their Role doc settings are ignored.
//   - A setting that was never saved (null / missing) = NOT configured =
//     unrestricted, so nothing breaks before roles are configured.
//   - Once saved (even as an empty list) it restricts to what is listed.
//   - An unknown role key (role deleted) behaves like an unconfigured role.
// Settings (models/Role.js): `taskTypes`, and `permissions` (+ its
// permissionsConfiguredAt marker, because legacy roles were seeded with [], and
// permissionsKnown — which keys were configured; see lib/permissionRules.js).

import "server-only";
import { cache } from "react";
import {
  PERMISSIONS,
  PERMISSION_KEYS,
  isFullAccess,
  isFullAccessRole,
  roleDocHasPermission,
} from "@/lib/permissionRules";
import Role from "@/models/Role";

/** The generic permission keys (labels for the Roles form). */
export { PERMISSIONS, PERMISSION_KEYS, roleDocHasPermission, isFullAccess };

/** One lookup per role key per request. */
const roleByKey = cache(async (key) => {
  if (!key || isFullAccessRole(key)) return null;
  return Role.findOne({ key }).select("key taskTypes permissions permissionsConfiguredAt permissionsKnown").lean();
});

/** Pure rule on a role doc (null = unconfigured). */
export const roleDocWorksOnType = (role, type) => !Array.isArray(role?.taskTypes) || role.taskTypes.includes(type);

/**
 * Does this user's role work on `type`? (Type enablement is checked separately by
 * the catalog: a disabled type is never creatable.)
 * @param {{ role?: string } | null} user  a User doc (or the viewer's `user`)
 */
export async function roleWorksOnType(user, type) {
  if (!user) return false;
  if (isFullAccess(user)) return true;
  return roleDocWorksOnType(await roleByKey(user.role), type);
}

/**
 * Task status OVERRIDE (round 40): may set ANY status of the type, beyond the
 * arrows and escape hatches (lib/tasks/transitions.js). Full access (superadmin
 * or manager — the app's "admin") and the project's owner.
 * @param {{ id: any, isAdmin?: boolean, user?: object } | null} viewer  getProjectViewer()
 */
export const canOverrideTaskStatus = (viewer, project) =>
  !!viewer && (!!viewer.isAdmin || isFullAccess(viewer.user) || (!!project?.owner && String(project.owner) === String(viewer.id)));

/** Does this user's role grant permission `key` (e.g. "review_content")? */
export async function hasPermission(user, key) {
  if (!user) return false;
  if (isFullAccess(user)) return true;
  return roleDocHasPermission(await roleByKey(user.role), key);
}
