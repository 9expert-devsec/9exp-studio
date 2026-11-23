// Pure role-permission rules (no DB, no server imports): shared by
// lib/permissions.js (the checks) and lib/team.js (the Roles page view).
//
// Rule: a permission that was never configured on a role = allowed. Because new
// keys get added over time (review_design came after review_content /
// review_video), "configured" is tracked PER KEY: when the Roles form saves a
// role's permissions it records which keys it showed (`permissionsKnown`). A key
// not in that list was never configured for the role → allowed. Roles saved before
// `permissionsKnown` existed knew only LEGACY_KNOWN_PERMISSIONS.
//
// FULL ACCESS (round 41): the role KEYS in FULL_ACCESS_ROLES pass every access
// check in the app, fixed in code: a Role document's own task-type / permission
// settings never matter for them. Superadmin and Manager are equal EXCEPT that
// only a superadmin may touch a superadmin account or hand out the superadmin
// role (canManageAccount / canAssignRole). Pure, so the Accounts page (client)
// uses the same rule to hide actions; every server action re-checks it.

export const SUPERADMIN = "superadmin";
export const MANAGER = "manager";
export const FULL_ACCESS_ROLES = [SUPERADMIN, MANAGER];

/** Is this role KEY a full-access role? */
export const isFullAccessRole = (roleKey) => FULL_ACCESS_ROLES.includes(roleKey);

/** Does this user ({ role } — a User doc or session user) have full access? */
export const isFullAccess = (user) => !!user && isFullAccessRole(user.role);

/**
 * May `actor` change `target`'s account (edit, role, (de)activate, unlock, reset
 * password, photo)? Full access required; a superadmin account only by a
 * superadmin. Self rules (can't deactivate yourself, …) are checked separately.
 * Pass the TARGET as read fresh from the DB.
 */
export function canManageAccount(actor, target) {
  if (!isFullAccess(actor) || !target) return false;
  if (target.role === SUPERADMIN) return actor.role === SUPERADMIN;
  return true;
}

/** May `actor` give `roleKey` to an account (create or role change)? */
export function canAssignRole(actor, roleKey) {
  if (!isFullAccess(actor)) return false;
  if (roleKey === SUPERADMIN) return actor.role === SUPERADMIN;
  return true;
}

export const MANAGE_ACCOUNT_DENIED = "Only a Super Admin can change a Super Admin account.";

export const PERMISSIONS = [
  { key: "review_content", label: "Content review" },
  { key: "review_video", label: "Video review" },
  { key: "review_design", label: "Design review" },
];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/** The keys the Roles form showed before `permissionsKnown` was recorded. */
export const LEGACY_KNOWN_PERMISSIONS = ["review_content", "review_video"];

const isConfigured = (role) => !!role?.permissionsConfiguredAt && Array.isArray(role.permissions);
const knownKeys = (role) => (Array.isArray(role?.permissionsKnown) ? role.permissionsKnown : LEGACY_KNOWN_PERMISSIONS);

/** Pure rule on a role doc (null = unconfigured → every permission allowed). */
export function roleDocHasPermission(role, key) {
  if (!isConfigured(role)) return true;
  if (!knownKeys(role).includes(key)) return true; // this key was never configured
  return role.permissions.includes(key);
}

/**
 * Roles page view: null = not configured (all allowed); else the EFFECTIVE list,
 * i.e. the saved keys plus keys this role never configured (allowed until saved).
 */
export function rolePermissionsView(role) {
  if (!isConfigured(role)) return null;
  return PERMISSION_KEYS.filter((k) => roleDocHasPermission(role, k));
}
