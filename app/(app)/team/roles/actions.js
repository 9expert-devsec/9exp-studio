"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the three role actions; helpers stay module-private.
//
// Each action re-reads the caller from the DB (authorizeSuperadmin), validates every
// field itself, and never takes `key` (on update), `isSystem` or `permissions`
// from the client.

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { authorizeSuperadmin } from "@/lib/team";
import Role, { ROLE_DESCRIPTION_MAX, ROLE_KEY_PATTERN, ROLE_NAME_MAX } from "@/models/Role";
import User from "@/models/User";

const fail = (error) => ({ ok: false, error });
const str = (v) => (typeof v === "string" ? v : "");

function readNameAndDescription(formData) {
  const name = str(formData.get("name")).trim();
  const description = str(formData.get("description")).trim();
  if (!name) return { error: "Name is required." };
  if (name.length > ROLE_NAME_MAX) return { error: `Name must be at most ${ROLE_NAME_MAX} characters.` };
  if (description.length > ROLE_DESCRIPTION_MAX) {
    return { error: `Description must be at most ${ROLE_DESCRIPTION_MAX} characters.` };
  }
  return { name, description };
}

async function findRole(formData) {
  const id = str(formData.get("id"));
  if (!mongoose.isValidObjectId(id)) return null;
  return Role.findById(id).lean();
}

export async function createRoleAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const fields = readNameAndDescription(formData);
  if (fields.error) return fail(fields.error);

  const key = str(formData.get("key")).trim().toLowerCase();
  if (!ROLE_KEY_PATTERN.test(key)) {
    return fail(
      "Key must be 2–32 characters: a lowercase letter first, then lowercase letters, digits, - or _."
    );
  }
  if (await Role.exists({ key })) return fail(`A role with key "${key}" already exists.`);

  try {
    await Role.create({ key, name: fields.name, description: fields.description });
  } catch (err) {
    if (err?.code === 11000) return fail(`A role with key "${key}" already exists.`);
    throw err;
  }

  refresh();
  return { ok: true };
}

export async function updateRoleAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const role = await findRole(formData);
  if (!role) return fail("That role no longer exists.");

  const fields = readNameAndDescription(formData);
  if (fields.error) return fail(fields.error);

  // Key is immutable; only name and description are written.
  await Role.updateOne(
    { _id: role._id },
    { $set: { name: fields.name, description: fields.description } },
    { runValidators: true }
  );

  refresh();
  return { ok: true };
}

export async function deleteRoleAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const role = await findRole(formData);
  if (!role) return fail("That role no longer exists.");
  if (role.isSystem) return fail("System roles cannot be deleted.");

  const inUse = await User.countDocuments({ role: role.key });
  if (inUse > 0) {
    return fail(
      `${inUse} account${inUse === 1 ? " uses" : "s use"} this role. Move ${
        inUse === 1 ? "it" : "them"
      } to another role first.`
    );
  }

  await Role.deleteOne({ _id: role._id, isSystem: { $ne: true } });

  refresh();
  return { ok: true };
}
