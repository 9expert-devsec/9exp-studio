// Pure role-permission rules (no DB, no server imports): shared by
// lib/permissions.js (the checks) and lib/team.js (the Roles page view).
//
// Rule: a permission that was never configured on a role = allowed. Because new
// keys get added over time (review_design came after review_content /
// review_video), "configured" is tracked PER KEY: when the Roles form saves a
// role's permissions it records which keys it showed (`permissionsKnown`). A key
// not in that list was never configured for the role → allowed. Roles saved before
// `permissionsKnown` existed knew only LEGACY_KNOWN_PERMISSIONS.

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
