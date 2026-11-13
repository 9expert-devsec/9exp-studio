"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY setFirstPasswordAction; helpers stay module-private.
//
// The one action allowed for a user whose DB doc has mustChangePassword. It acts
// only on the session's own user id. Passwords and hashes are never logged.

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import dbConnect from "@/lib/db";
import { BCRYPT_COST, validateNewPassword } from "@/lib/password";
import User from "@/models/User";

const fail = (error) => ({ ok: false, error });
const str = (v) => (typeof v === "string" ? v : "");

export async function setFirstPasswordAction(_prevState, formData) {
  // 1. Identity comes from the session only.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return fail("Your session has expired. Please sign in again.");
  }

  const temporaryPassword = str(formData.get("temporaryPassword"));
  const newPassword = str(formData.get("newPassword"));
  const confirmPassword = str(formData.get("confirmPassword"));
  if (!temporaryPassword || !newPassword || !confirmPassword) {
    return fail("Please fill in all three fields.");
  }

  // 2. Fresh DB read; nothing to do here unless the flag is set.
  await dbConnect();
  const user = await User.findById(userId).select("+passwordHash email isActive mustChangePassword");
  if (!user || !user.isActive) return fail("Your account is not available. Please sign in again.");
  if (!user.mustChangePassword) redirect("/");

  // 3. Verify the temporary password. Deliberately NOT counted toward the
  //    sign-in lockout (the person is already signed in).
  const valid = await bcrypt.compare(temporaryPassword, user.passwordHash);
  if (!valid) return fail("Temporary password is incorrect.");

  // 4. Same rules as everywhere else (lib/password.js).
  const invalid = validateNewPassword(newPassword, confirmPassword, {
    label: "New password",
    previous: temporaryPassword,
  });
  if (invalid) return fail(invalid);

  // 5. Save.
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }
  );

  // 6. Re-issue the session with the new credentials: authorize() reads the DB
  //    again, so the fresh JWT carries mustChangePassword: false. No client-trusted
  //    session update is involved.
  try {
    await signIn("credentials", { email: user.email, password: newPassword, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail("Your password was changed, but signing you in again failed. Please sign in with your new password.");
    }
    // Next.js's redirect (and anything unexpected) must propagate.
    throw error;
  }

  return { ok: true };
}
