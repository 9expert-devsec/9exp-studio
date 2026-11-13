// Temporary-password generator shared by scripts/create-user.mjs and the
// Team Management server actions. Plain Node: no Next.js-only imports.

import { randomBytes } from "node:crypto";

export function generateTemporaryPassword() {
  // 18 random bytes -> 24 URL-safe characters (~144 bits of entropy).
  return randomBytes(18).toString("base64url");
}
