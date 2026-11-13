// Password helpers shared by scripts/create-user.mjs, the Team Management actions,
// /account and /first-login. Plain Node: no Next.js-only imports.

import { randomBytes } from "node:crypto";

export const PASSWORD_MIN_BYTES = 10;
export const PASSWORD_MAX_BYTES = 72; // bcrypt only uses the first 72 bytes.
export const BCRYPT_COST = 12;

export function generateTemporaryPassword() {
  // 18 random bytes -> 24 URL-safe characters (~144 bits of entropy).
  return randomBytes(18).toString("base64url");
}

const byteLength = (s) => new TextEncoder().encode(s).length;

/**
 * Validate a chosen password: 10–72 UTF-8 bytes, matches its confirmation, and
 * (optionally) differs from a previous one.
 * @param {string} password
 * @param {string} confirm
 * @param {{ label?: string, previous?: string }} [opts]
 * @returns {string | null} an error message, or null when valid
 */
export function validateNewPassword(password, confirm, { label = "Password", previous } = {}) {
  if (typeof password !== "string" || !password) return `${label} is required.`;
  const bytes = byteLength(password);
  if (bytes < PASSWORD_MIN_BYTES) return `${label} must be at least ${PASSWORD_MIN_BYTES} characters.`;
  if (bytes > PASSWORD_MAX_BYTES) {
    return `${label} is too long (max ${PASSWORD_MAX_BYTES} bytes; Thai and other non-Latin characters count as 3).`;
  }
  if (password !== confirm) return `${label} and confirmation do not match.`;
  if (previous !== undefined && password === previous) {
    return `${label} must be different from the current password.`;
  }
  return null;
}
