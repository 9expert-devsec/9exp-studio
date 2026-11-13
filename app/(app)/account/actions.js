"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY changePasswordAction, updateMyAvatarAction and removeMyAvatarAction;
// keep helpers module-private. All three act ONLY on the session's own user id,
// and refuse users whose DB doc still has mustChangePassword (they belong on
// /first-login; the JWT flag alone is not trusted).

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { refresh } from "next/cache";
import { auth } from "@/auth";
import { readAvatarFile, removeAvatar, replaceAvatar } from "@/lib/avatar";
import dbConnect from "@/lib/db";
import { BCRYPT_COST, validateNewPassword } from "@/lib/password";
import { MUST_CHANGE_PASSWORD_ERROR } from "@/lib/team";
import User from "@/models/User";

const fail = (error) => ({ ok: false, error });
const str = (v) => (typeof v === "string" ? v : "");

export async function changePasswordAction(_prevState, formData) {
  // Identity comes from the session only, never from the form.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return fail("Your session has expired. Please sign in again.");
  }

  const currentPassword = str(formData.get("currentPassword"));
  const newPassword = str(formData.get("newPassword"));
  const confirmPassword = str(formData.get("confirmPassword"));

  if (!currentPassword || !newPassword || !confirmPassword) {
    return fail("Please fill in all three fields.");
  }
  const invalid = validateNewPassword(newPassword, confirmPassword, {
    label: "New password",
    previous: currentPassword,
  });
  if (invalid) return fail(invalid);

  await dbConnect();
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !user.isActive) {
    return fail("Your account is not available. Please sign in again.");
  }
  if (user.mustChangePassword) return fail(MUST_CHANGE_PASSWORD_ERROR);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return fail("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false } }
  );

  // KNOWN LIMITATION: other existing sessions stay signed in. Sessions are JWTs
  // checked at the edge with no DB lookup, so there is nothing to revoke yet.
  // (A later fix: compare token iat with passwordChangedAt on a server check.)
  return { ok: true };
}

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

// The caller's own active user id from the session (checked against the DB).
async function myUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !mongoose.isValidObjectId(userId)) return { error: SESSION_EXPIRED };
  await dbConnect();
  const me = await User.findById(userId).select("isActive mustChangePassword").lean();
  if (!me?.isActive) return { error: SESSION_EXPIRED };
  if (me.mustChangePassword) return { error: MUST_CHANGE_PASSWORD_ERROR };
  return { userId: me._id };
}

// Profile picture: validated server-side (magic bytes, ≤ 1 MB, ≤ 1024px), then
// uploaded to Cloudinary and saved. refresh() re-renders the server components so
// the header pill and user menu show the new picture without a reload.
export async function updateMyAvatarAction(formData) {
  const { userId, error } = await myUserId();
  if (error) return fail(error);

  const file = await readAvatarFile(formData);
  if (file.error) return fail(file.error);

  const result = await replaceAvatar(userId, file.buffer);
  if (result.ok) refresh();
  return result;
}

export async function removeMyAvatarAction() {
  const { userId, error } = await myUserId();
  if (error) return fail(error);

  const result = await removeAvatar(userId);
  if (result.ok) refresh();
  return result;
}
