"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

const GENERIC_ERROR = "Invalid email or password.";

export async function loginAction(_prevState, formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    // CredentialsSignin extends AuthError. Same message for wrong password,
    // unknown email, locked or inactive account.
    if (error instanceof AuthError) {
      return { error: GENERIC_ERROR };
    }
    // Anything else (including Next.js's redirect) must propagate.
    throw error;
  }

  return { error: null };
}
