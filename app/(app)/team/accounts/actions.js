"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the six account actions (four account + two avatar); helpers stay
// module-private.
//
// Every action:
//   1. re-reads the caller's session and 2. re-reads the caller's user doc from the
//      DB, requiring an active superadmin (a stale JWT role is never trusted);
//   3. validates every input;
//   4. takes the target's role only from the validated `role` field, checked
//      against the `roles` collection. Nothing else about roles/permissions is read.
//
// Temporary passwords are returned to the caller ONCE in the action result. They
// are never stored in plain text and never logged.
//
// See lib/team.js for the JWT session limitations (role/active changes reach the
// affected user's session at their next sign-in).

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { refresh } from "next/cache";
import { readAvatarFile, removeAvatar, replaceAvatar } from "@/lib/avatar";
import { generateTemporaryPassword } from "@/lib/password";
import { SUPERADMIN, getSuperadmin } from "@/lib/team";
import Role from "@/models/Role";
import User from "@/models/User";

const BCRYPT_COST = 12;
const NAME_MAX = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (error) => ({ ok: false, error });
const str = (v) => (typeof v === "string" ? v : "");
const NOT_ALLOWED = "You are not allowed to manage accounts. Please sign in again.";
const LAST_SUPERADMIN =
  "This would leave no active Super Admin. Make another account an active Super Admin first.";

function readName(formData) {
  const name = str(formData.get("name")).trim();
  if (!name) return { error: "Name is required." };
  if (name.length > NAME_MAX) return { error: `Name must be at most ${NAME_MAX} characters.` };
  return { name };
}

async function readRole(formData) {
  const role = str(formData.get("role")).trim().toLowerCase();
  if (!role || !(await Role.exists({ key: role }))) return { error: "Choose a valid role." };
  return { role };
}

async function findTarget(formData) {
  const id = str(formData.get("id"));
  if (!mongoose.isValidObjectId(id)) return null;
  return User.findById(id).select("role isActive").lean();
}

// True when `target` is an active superadmin now, will not be after the write,
// and no other active superadmin exists.
async function removesLastSuperadmin(target, next) {
  const isNow = target.isActive && target.role === SUPERADMIN;
  const willBe = next.isActive && next.role === SUPERADMIN;
  if (!isNow || willBe) return false;
  const others = await User.countDocuments({
    _id: { $ne: target._id },
    role: SUPERADMIN,
    isActive: true,
  });
  return others === 0;
}

const hashTemporaryPassword = async () => {
  const password = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  return { password, passwordHash };
};

export async function createAccountAction(formData) {
  if (!(await getSuperadmin())) return fail(NOT_ALLOWED);

  const email = str(formData.get("email")).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");

  const name = readName(formData);
  if (name.error) return fail(name.error);

  const role = await readRole(formData);
  if (role.error) return fail(role.error);

  if (await User.exists({ email })) return fail("An account with this email already exists.");

  const { password, passwordHash } = await hashTemporaryPassword();
  try {
    await User.create({ email, name: name.name, role: role.role, passwordHash });
  } catch (err) {
    if (err?.code === 11000) return fail("An account with this email already exists.");
    throw err;
  }

  refresh();
  return { ok: true, password };
}

export async function updateAccountAction(formData) {
  const me = await getSuperadmin();
  if (!me) return fail(NOT_ALLOWED);

  const target = await findTarget(formData);
  if (!target) return fail("That account no longer exists.");

  const name = readName(formData);
  if (name.error) return fail(name.error);

  const role = await readRole(formData);
  if (role.error) return fail(role.error);

  const isActive = str(formData.get("isActive")) === "true";
  const isSelf = target._id.equals(me._id);

  if (isSelf && !isActive) return fail("You cannot deactivate your own account.");
  if (isSelf && role.role !== target.role) return fail("You cannot change your own role.");
  if (await removesLastSuperadmin(target, { role: role.role, isActive })) {
    return fail(LAST_SUPERADMIN);
  }

  await User.updateOne(
    { _id: target._id },
    { $set: { name: name.name, role: role.role, isActive } }
  );

  refresh();
  return { ok: true };
}

export async function resetPasswordAction(formData) {
  if (!(await getSuperadmin())) return fail(NOT_ALLOWED);

  const target = await findTarget(formData);
  if (!target) return fail("That account no longer exists.");

  const { password, passwordHash } = await hashTemporaryPassword();
  await User.updateOne(
    { _id: target._id },
    {
      $set: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0 },
      $unset: { lockedUntil: 1 },
    }
  );

  refresh();
  return { ok: true, password };
}

export async function unlockAccountAction(formData) {
  if (!(await getSuperadmin())) return fail(NOT_ALLOWED);

  const target = await findTarget(formData);
  if (!target) return fail("That account no longer exists.");

  await User.updateOne(
    { _id: target._id },
    { $set: { failedLoginCount: 0 }, $unset: { lockedUntil: 1 } }
  );

  refresh();
  return { ok: true };
}

// Profile picture for any account (superadmin). Same validation and
// upload-then-save-then-delete-old flow as the self-service actions (lib/avatar.js).
export async function updateAccountAvatarAction(formData) {
  if (!(await getSuperadmin())) return fail(NOT_ALLOWED);

  const target = await findTarget(formData);
  if (!target) return fail("That account no longer exists.");

  const file = await readAvatarFile(formData);
  if (file.error) return fail(file.error);

  const result = await replaceAvatar(target._id, file.buffer);
  if (result.ok) refresh();
  return result;
}

export async function removeAccountAvatarAction(formData) {
  if (!(await getSuperadmin())) return fail(NOT_ALLOWED);

  const target = await findTarget(formData);
  if (!target) return fail("That account no longer exists.");

  const result = await removeAvatar(target._id);
  if (result.ok) refresh();
  return result;
}
