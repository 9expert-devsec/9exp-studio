"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY signOutAction (used by the user menu and /first-login).

import { signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
