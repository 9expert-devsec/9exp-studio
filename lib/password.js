// Password rules: the ONE place they live. Used by the server actions (Team, /account,
// /first-login), scripts/create-user.mjs, and the client hints (PasswordRules).
// Isomorphic: no Node-only imports (Web Crypto + btoa exist in Node 22 and browsers).

export const PASSWORD_MIN_CHARS = 8; // Unicode code points: 8 Thai characters count as 8.
export const PASSWORD_MAX_BYTES = 72; // UTF-8 bytes: bcrypt only uses the first 72.
export const BCRYPT_COST = 12;

// Shared wording (client hints and server errors say the same thing).
export const PASSWORD_TOO_LONG = "Too long (max 72 bytes; Thai characters count as 3)";
export const PASSWORDS_DONT_MATCH = "Passwords don't match";

export const charLength = (s) => [...String(s ?? "")].length;
export const byteLength = (s) => new TextEncoder().encode(String(s ?? "")).length;

export function generateTemporaryPassword() {
  // 18 random bytes -> 24 URL-safe characters (~144 bits of entropy).
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Live state for the inline hints and disabled-submit logic.
 * @returns {{ chars: number, tooShort: boolean, tooLong: boolean, mismatch: boolean, matches: boolean }}
 */
export function checkPassword(password = "", confirm = "") {
  const chars = charLength(password);
  return {
    chars,
    tooShort: chars < PASSWORD_MIN_CHARS,
    tooLong: byteLength(password) > PASSWORD_MAX_BYTES,
    mismatch: confirm.length > 0 && confirm !== password,
    matches: confirm.length > 0 && confirm === password,
  };
}

/**
 * Validate a chosen password: at least 8 characters, at most 72 UTF-8 bytes, matches
 * its confirmation, and (optionally) differs from a previous one.
 * @param {string} password
 * @param {string} confirm
 * @param {{ label?: string, previous?: string }} [opts]
 * @returns {string | null} an error message, or null when valid
 */
export function validateNewPassword(password, confirm, { label = "Password", previous } = {}) {
  if (typeof password !== "string" || !password) return `${label} is required.`;
  const state = checkPassword(password, typeof confirm === "string" ? confirm : "");
  if (state.tooShort) return `${label} must be at least ${PASSWORD_MIN_CHARS} characters.`;
  if (state.tooLong) return `${label}: ${PASSWORD_TOO_LONG}.`;
  if (password !== confirm) return `${PASSWORDS_DONT_MATCH}.`;
  if (previous !== undefined && password === previous) {
    return `${label} must be different from the current password.`;
  }
  return null;
}
