"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY changePasswordAction, updateMyAvatarAction and removeMyAvatarAction;
// keep helpers module-private. All three act ONLY on the session's own user id.

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { refresh } from "next/cache";
import { auth } from "@/auth";
import { readAvatarFile, removeAvatar, replaceAvatar } from "@/lib/avatar";
import dbConnect from "@/lib/db";
import User from "@/models/User";

const MIN_BYTES = 10;
const MAX_BYTES = 72; // bcrypt only uses the first 72 bytes.

const fail = (error) => ({ ok: false, error });
const byteLength = (s) => new TextEncoder().encode(s).length;
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
  const bytes = byteLength(newPassword);
  if (bytes < MIN_BYTES) {
    return fail(`New password must be at least ${MIN_BYTES} characters.`);
  }
  if (bytes > MAX_BYTES) {
    return fail(
      `New password is too long (max ${MAX_BYTES} bytes; Thai and other non-Latin characters count as 3).`
    );
  }
  if (newPassword !== confirmPassword) {
    return fail("New password and confirmation do not match.");
  }
  if (newPassword === currentPassword) {
    return fail("New password must be different from the current password.");
  }

  await dbConnect();
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !user.isActive) {
    return fail("Your account is not available. Please sign in again.");
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return fail("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash, passwordChangedAt: new Date() } }
  );

  // KNOWN LIMITATION: other existing sessions stay signed in. Sessions are JWTs
  // checked at the edge with no DB lookup, so there is nothing to revoke yet.
  // (A later fix: compare token iat with passwordChangedAt on a server check.)
  return { ok: true };
}

// The caller's own active user id from the session, or null.
async function myUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !mongoose.isValidObjectId(userId)) return null;
  await dbConnect();
  const me = await User.findById(userId).select("isActive").lean();
  return me?.isActive ? me._id : null;
}

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

// Profile picture: validated server-side (magic bytes, ≤ 1 MB, ≤ 1024px), then
// uploaded to Cloudinary and saved. refresh() re-renders the server components so
// the header pill and user menu show the new picture without a reload.
export async function updateMyAvatarAction(formData) {
  const userId = await myUserId();
  if (!userId) return fail(SESSION_EXPIRED);

  const file = await readAvatarFile(formData);
  if (file.error) return fail(file.error);

  const result = await replaceAvatar(userId, file.buffer);
  if (result.ok) refresh();
  return result;
}

export async function removeMyAvatarAction() {
  const userId = await myUserId();
  if (!userId) return fail(SESSION_EXPIRED);

  const result = await removeAvatar(userId);
  if (result.ok) refresh();
  return result;
}
