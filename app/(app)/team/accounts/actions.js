"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the six account actions (four account + two avatar); helpers stay
// module-private.
//
// Every action:
//   1. re-reads the caller's session and 2. re-reads the caller's user doc from the
//      DB (authorizeSuperadmin): an active superadmin who does not still have to
//      change their own password. A stale JWT role/flag is never trusted;
//   3. validates every input;
//   4. takes the target's role only from the validated `role` field, checked
//      against the `roles` collection. Nothing else about roles/permissions is read.
//
// Passwords: generated ones are returned to the caller ONCE in the action result;
// chosen ones are never echoed back. Neither is stored in plain text or logged.
// Admin-provisioned passwords set mustChangePassword: the person must replace them
// at their first sign-in (/first-login).
//
// See lib/team.js for the JWT session limitations (role/active changes reach the
// affected user's session at their next sign-in).

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { refresh } from "next/cache";
import { readAvatarFile, removeAvatar, replaceAvatar } from "@/lib/avatar";
import { BCRYPT_COST, generateTemporaryPassword, validateNewPassword } from "@/lib/password";
import { SUPERADMIN, authorizeSuperadmin } from "@/lib/team";
import Role from "@/models/Role";
import User from "@/models/User";

const NAME_MAX = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (error) => ({ ok: false, error });
const str = (v) => (typeof v === "string" ? v : "");
const LAST_SUPERADMIN =
  "This would leave no active Super Admin. Make another account an active Super Admin first.";
const PHOTO_WARNING = "Account created, but the photo could not be uploaded.";

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

// passwordMode: "generate" (default) | "set" (password + passwordConfirm, same rules
// as /first-login). Returns the hash, plus the plain password ONLY when generated.
async function readPasswordChoice(formData) {
  const mode = str(formData.get("passwordMode")) === "set" ? "set" : "generate";
  if (mode === "set") {
    const password = str(formData.get("password"));
    const error = validateNewPassword(password, str(formData.get("passwordConfirm")));
    if (error) return { error };
    return { mode, passwordHash: await bcrypt.hash(password, BCRYPT_COST) };
  }
  const password = generateTemporaryPassword();
  return { mode, password, passwordHash: await bcrypt.hash(password, BCRYPT_COST) };
}

// Optional `avatar` file on create. Missing/empty = no photo.
function hasAvatar(formData) {
  const file = formData.get("avatar");
  return !!file && typeof file !== "string" && file.size > 0;
}

export async function createAccountAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const email = str(formData.get("email")).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");

  const name = readName(formData);
  if (name.error) return fail(name.error);

  const role = await readRole(formData);
  if (role.error) return fail(role.error);

  // Validate the photo up front, but upload it only after the account exists.
  let avatar = null;
  let warning;
  if (hasAvatar(formData)) {
    avatar = await readAvatarFile(formData);
    if (avatar.error) {
      warning = PHOTO_WARNING;
      avatar = null;
    }
  }

  const choice = await readPasswordChoice(formData);
  if (choice.error) return fail(choice.error);

  if (await User.exists({ email })) return fail("An account with this email already exists.");

  let user;
  try {
    user = await User.create({
      email,
      name: name.name,
      role: role.role,
      passwordHash: choice.passwordHash,
      mustChangePassword: true,
    });
  } catch (err) {
    if (err?.code === 11000) return fail("An account with this email already exists.");
    throw err;
  }

  // Same helper as round 13: upload, save, and delete the new upload if the save
  // fails (guarded delete). A photo failure keeps the account.
  if (avatar) {
    const result = await replaceAvatar(user._id, avatar.buffer);
    if (!result.ok) warning = PHOTO_WARNING;
  }

  refresh();
  return {
    ok: true,
    mode: choice.mode,
    ...(choice.mode === "generate" ? { password: choice.password } : {}),
    ...(warning ? { warning } : {}),
  };
}

export async function updateAccountAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);
  const { me } = caller;

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

// KNOWN LIMITATION: sessions are JWTs, so a session the target already has keeps
// working until it expires (7 days). Their NEXT sign-in needs the new password and
// then the forced change at /first-login.
export async function resetPasswordAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const target = await findTarget(formData);
  if (!target) return fail("That account no longer exists.");
  if (target._id.equals(caller.me._id)) {
    return fail("You cannot reset your own password here. Change it on the Account page.");
  }

  const choice = await readPasswordChoice(formData);
  if (choice.error) return fail(choice.error);

  await User.updateOne(
    { _id: target._id },
    {
      $set: {
        passwordHash: choice.passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: true,
        failedLoginCount: 0,
      },
      $unset: { lockedUntil: 1 },
    }
  );

  refresh();
  return {
    ok: true,
    mode: choice.mode,
    ...(choice.mode === "generate" ? { password: choice.password } : {}),
  };
}

export async function unlockAccountAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

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
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const target = await findTarget(formData);
  if (!target) return fail("That account no longer exists.");

  const file = await readAvatarFile(formData);
  if (file.error) return fail(file.error);

  const result = await replaceAvatar(target._id, file.buffer);
  if (result.ok) refresh();
  return result;
}

export async function removeAccountAvatarAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const target = await findTarget(formData);
  if (!target) return fail("That account no longer exists.");

  const result = await removeAvatar(target._id);
  if (result.ok) refresh();
  return result;
}
