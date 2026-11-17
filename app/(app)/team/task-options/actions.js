"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the task-option actions; helpers stay module-private.
//
// Superadmin only: each action re-reads the caller from the DB
// (authorizeSuperadmin) and validates every field itself.

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { escapeRegex } from "@/lib/projects/rules";
import { authorizeSuperadmin } from "@/lib/team";
import { PLATFORM_MARK_KEYS, TASK_OPTION_LABEL_MAX, getOptionList } from "@/lib/tasks/options";
import Task from "@/models/Task";
import TaskOption from "@/models/TaskOption";

const fail = (error) => ({ ok: false, error });
const str = (v) => (typeof v === "string" ? v : "");

async function findOption(formData) {
  const id = str(formData.get("id"));
  if (!mongoose.isValidObjectId(id)) return null;
  return TaskOption.findById(id).lean();
}

/** Label (+ icon for lists that have one); duplicate labels in a list (any case) are rejected. */
async function readFields(formData, list, selfId = null) {
  const label = str(formData.get("label")).trim();
  if (!label) return { error: "Label is required." };
  if (label.length > TASK_OPTION_LABEL_MAX) return { error: `Use at most ${TASK_OPTION_LABEL_MAX} characters.` };
  const dup = await TaskOption.exists({
    list: list.key,
    label: new RegExp(`^${escapeRegex(label)}$`, "i"),
    ...(selfId ? { _id: { $ne: selfId } } : {}),
  });
  if (dup) return { error: `“${label}” already exists in ${list.label}.` };
  let icon = null;
  if (list.hasIcon) {
    icon = str(formData.get("icon"));
    if (!PLATFORM_MARK_KEYS.includes(icon)) return { error: "Choose an icon." };
  }
  return { label, icon };
}

export async function createTaskOptionAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const list = getOptionList(str(formData.get("list")));
  if (!list) return fail("Unknown list.");
  const fields = await readFields(formData, list);
  if (fields.error) return fail(fields.error);

  const last = await TaskOption.findOne({ list: list.key }).sort({ order: -1 }).select("order").lean();
  try {
    await TaskOption.create({
      list: list.key,
      label: fields.label,
      icon: fields.icon,
      order: (last?.order ?? 0) + 1,
      active: true,
      createdBy: caller.me._id,
    });
  } catch (err) {
    if (err?.code === 11000) return fail(`“${fields.label}” already exists in ${list.label}.`);
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function updateTaskOptionAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const option = await findOption(formData);
  if (!option) return fail("That option no longer exists.");
  const list = getOptionList(option.list);
  const fields = await readFields(formData, list, option._id);
  if (fields.error) return fail(fields.error);

  try {
    await TaskOption.updateOne({ _id: option._id }, { $set: { label: fields.label, icon: fields.icon } }, { runValidators: true });
  } catch (err) {
    if (err?.code === 11000) return fail(`“${fields.label}” already exists in ${list.label}.`);
    throw err;
  }
  refresh();
  return { ok: true };
}

/** Active ⇄ inactive. Inactive options leave pickers but still show on tasks using them. */
export async function toggleTaskOptionAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const option = await findOption(formData);
  if (!option) return fail("That option no longer exists.");
  await TaskOption.updateOne({ _id: option._id }, { $set: { active: !option.active } });
  refresh();
  return { ok: true };
}

/** Move one step up/down within its list (swaps `order` with the neighbour). */
export async function moveTaskOptionAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const option = await findOption(formData);
  if (!option) return fail("That option no longer exists.");
  const up = str(formData.get("direction")) === "up";

  // Normalise orders to 1..n first, so duplicates/gaps can't block a swap.
  const all = await TaskOption.find({ list: option.list }).sort({ order: 1, label: 1 }).select("_id").lean();
  const ids = all.map((o) => o._id.toString());
  const i = ids.indexOf(option._id.toString());
  const j = up ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await TaskOption.bulkWrite(ids.map((id, n) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: n + 1 } } } })));
  refresh();
  return { ok: true };
}

/** Delete, unless any task references it (then suggest deactivating). */
export async function deleteTaskOptionAction(formData) {
  const caller = await authorizeSuperadmin();
  if (caller.error) return fail(caller.error);

  const option = await findOption(formData);
  if (!option) return fail("That option no longer exists.");
  const used = await Task.countDocuments({ $or: [{ "details.videoType": option._id }, { "details.platforms": option._id }] });
  if (used > 0) {
    return fail(
      `${used} task${used === 1 ? " uses" : "s use"} “${option.label}”, so it can't be deleted. Deactivate it instead — it will leave the pickers but stay on those tasks.`
    );
  }
  await TaskOption.deleteOne({ _id: option._id });
  refresh();
  return { ok: true };
}
