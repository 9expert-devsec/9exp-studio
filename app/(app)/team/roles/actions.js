"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the three role actions; helpers stay module-private.
//
// Each action re-reads the caller from the DB (authorizeSuperadmin), validates every
// field itself, and never takes `key` (on update) or `isSystem` from the client.
// Task types / permissions are validated against their key lists.

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { SUPERADMIN, authorizeSuperadmin } from "@/lib/team";
import { TASK_TYPE_KEYS } from "@/lib/tasks/types";
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

/**
 * The two role settings. Each has a mode: "all" (not configured → unrestricted)
 * or "limited" (only the checked keys; may be empty). Unknown keys are dropped.
 * Returns { set, unset } fragments for the update (or plain values for create).
 */
function readRoleSettings(formData) {
  const pick = (field, allowed) => [...new Set(formData.getAll(field).map(str))].filter((k) => allowed.includes(k));
  const set = {};
  const unset = {};
  if (str(formData.get("taskTypesMode")) === "limited") set.taskTypes = pick("taskTypes", TASK_TYPE_KEYS);
  else unset.taskTypes = 1;
  if (str(formData.get("permissionsMode")) === "limited") {
    set.permissions = pick("permissions", PERMISSION_KEYS);
    set.permissionsConfiguredAt = new Date();
    // Every key the form showed is now configured for this role (lib/permissionRules.js).
    set.permissionsKnown = PERMISSION_KEYS;
  } else {
    unset.permissions = 1;
    unset.permissionsKnown = 1;
    set.permissionsConfiguredAt = null;
  }
  return { set, unset };
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

  const settings = readRoleSettings(formData);
  try {
    await Role.create({ key, name: fields.name, description: fields.description, ...settings.set });
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

  // Key is immutable. Superadmin always passes every permission check, so its
  // settings are never written.
  const update = { $set: { name: fields.name, description: fields.description } };
  if (role.key !== SUPERADMIN) {
    const settings = readRoleSettings(formData);
    Object.assign(update.$set, settings.set);
    if (Object.keys(settings.unset).length) update.$unset = settings.unset;
  }
  await Role.updateOne({ _id: role._id }, update, { runValidators: true });

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
