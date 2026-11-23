"use server";

// Every export of a "use server" module is a public POST endpoint.
// Export ONLY the task-option actions; helpers stay module-private.
//
// Full access only (superadmin or manager): each action re-reads the caller from the DB
// (authorizeFullAccess) and validates every field itself.

import mongoose from "mongoose";
import { refresh } from "next/cache";
import { syncMsdbRefs } from "@/lib/msdbSync";
import { setNextFolderNumber } from "@/lib/tasks/folderCounter";
import { escapeRegex } from "@/lib/projects/rules";
import { authorizeFullAccess } from "@/lib/team";
import { PLATFORM_MARK_KEYS, TASK_OPTION_LABEL_MAX, WORK_TYPE_PLATFORMS_MAX, getOptionList } from "@/lib/tasks/options";
import { EXTERNAL_NAME_MAX, EXTERNAL_NOTE_MAX, cleanExternalName, externalNameKey } from "@/lib/tasks/production";
import ExternalPerson from "@/models/ExternalPerson";
import Task from "@/models/Task";
import TaskOption from "@/models/TaskOption";

const fail = (error) => ({ ok: false, error });
const linkedMessage = (n) =>
  `Linked to ${n} work type${n === 1 ? "" : "s"} — unlink ${n === 1 ? "it" : "them"} or deactivate the platform instead.`;
const str = (v) => (typeof v === "string" ? v : "");

async function findOption(formData) {
  const id = str(formData.get("id"));
  if (!mongoose.isValidObjectId(id)) return null;
  return TaskOption.findById(id).lean();
}

/**
 * Work Type → linked platforms: ≥ 1, each an existing option of the `platform`
 * list (active or inactive). Returns { platforms: ObjectId[] } or { error }.
 */
async function readPlatforms(formData) {
  const ids = [...new Set(formData.getAll("platforms").map(str).filter(Boolean))];
  if (ids.length === 0) return { error: "Choose at least one platform." };
  if (ids.length > WORK_TYPE_PLATFORMS_MAX) return { error: `Choose at most ${WORK_TYPE_PLATFORMS_MAX} platforms.` };
  if (!ids.every((id) => mongoose.isValidObjectId(id))) return { error: "Choose platforms from the list." };
  const found = await TaskOption.countDocuments({ _id: { $in: ids }, list: "platform" });
  if (found !== ids.length) return { error: "One of those platforms no longer exists. Reload and try again." };
  return { platforms: ids.map((id) => new mongoose.Types.ObjectId(id)) };
}

/** Label (+ icon / platforms for lists that have them); duplicate labels in a list (any case) are rejected. */
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
  let platforms;
  if (list.hasPlatforms) {
    const read = await readPlatforms(formData);
    if (read.error) return { error: read.error };
    platforms = read.platforms;
  }
  return { label, icon, platforms };
}

export async function createTaskOptionAction(formData) {
  const caller = await authorizeFullAccess();
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
      ...(list.hasPlatforms ? { platforms: fields.platforms } : {}),
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
  const caller = await authorizeFullAccess();
  if (caller.error) return fail(caller.error);

  const option = await findOption(formData);
  if (!option) return fail("That option no longer exists.");
  const list = getOptionList(option.list);
  const fields = await readFields(formData, list, option._id);
  if (fields.error) return fail(fields.error);

  try {
    // platforms only exists on lists with hasPlatforms; strip it everywhere else.
    const update = list.hasPlatforms
      ? { $set: { label: fields.label, icon: fields.icon, platforms: fields.platforms } }
      : { $set: { label: fields.label, icon: fields.icon }, $unset: { platforms: 1 } };
    await TaskOption.updateOne({ _id: option._id }, update, { runValidators: true });
  } catch (err) {
    if (err?.code === 11000) return fail(`“${fields.label}” already exists in ${list.label}.`);
    throw err;
  }
  refresh();
  return { ok: true };
}

/** Active ⇄ inactive. Inactive options leave pickers but still show on tasks using them. */
export async function toggleTaskOptionAction(formData) {
  const caller = await authorizeFullAccess();
  if (caller.error) return fail(caller.error);

  const option = await findOption(formData);
  if (!option) return fail("That option no longer exists.");
  await TaskOption.updateOne({ _id: option._id }, { $set: { active: !option.active } });
  refresh();
  return { ok: true };
}

/** Move one step up/down within its list (swaps `order` with the neighbour). */
export async function moveTaskOptionAction(formData) {
  const caller = await authorizeFullAccess();
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
  const caller = await authorizeFullAccess();
  if (caller.error) return fail(caller.error);

  const option = await findOption(formData);
  if (!option) return fail("That option no longer exists.");
  // A platform linked from any work type can't be deleted (deactivating keeps links).
  if (option.list === "platform") {
    const linked = await TaskOption.countDocuments({ list: "work_type", platforms: option._id });
    if (linked > 0) return fail(linkedMessage(linked));
  }
  const used = await Task.countDocuments({
    $or: [
      { "details.videoType": option._id },
      { "details.platforms": option._id },
      { "details.platform": option._id },
      { "details.workType": option._id },
      { "details.articleType": option._id },
      { "details.photoType": option._id },
    ],
  });
  if (used > 0) {
    return fail(
      `${used} task${used === 1 ? " uses" : "s use"} “${option.label}”, so it can't be deleted. Deactivate it instead — it will leave the pickers but stay on those tasks.`
    );
  }
  await TaskOption.deleteOne({ _id: option._id });
  refresh();
  return { ok: true };
}

/**
 * Folder ID "next number" for the current Bangkok month + one issuing suffix
 * (lib/tasks/folderCounter.js). Rejects a number the system already issued.
 */
export async function setNextFolderNumberAction(formData) {
  const caller = await authorizeFullAccess();
  if (caller.error) return fail(caller.error);

  const raw = str(formData.get("next")).trim();
  const next = /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
  const res = await setNextFolderNumber(str(formData.get("suffix")), next);
  if (!res.ok) return fail(res.error);
  refresh();
  return { ok: true, nextId: res.nextId };
}

// ── External Presenters (round 38) ───────────────────────────────────────

async function findExternalPerson(formData) {
  const id = str(formData.get("id"));
  if (!mongoose.isValidObjectId(id)) return null;
  return ExternalPerson.findById(id).lean();
}

/** Tasks whose Presenters include this external person. */
const externalUsage = (id) => Task.countDocuments({ "details.presenters": { $elemMatch: { kind: "external", id } } });

/** Rename + note. The new name's nameKey must stay unique (case/space-insensitive). */
export async function updateExternalPersonAction(formData) {
  const caller = await authorizeFullAccess();
  if (caller.error) return fail(caller.error);

  const person = await findExternalPerson(formData);
  if (!person) return fail("That person no longer exists.");
  const name = cleanExternalName(formData.get("name"));
  if (!name) return fail("Name is required.");
  if (name.length > EXTERNAL_NAME_MAX) return fail(`Use at most ${EXTERNAL_NAME_MAX} characters.`);
  const note = str(formData.get("note")).trim();
  if (note.length > EXTERNAL_NOTE_MAX) return fail(`Keep the note to ${EXTERNAL_NOTE_MAX} characters.`);
  const nameKey = externalNameKey(name);
  if (await ExternalPerson.exists({ nameKey, _id: { $ne: person._id } })) return fail(`“${name}” already exists.`);
  try {
    await ExternalPerson.updateOne({ _id: person._id }, { $set: { name, nameKey, note } });
  } catch (err) {
    if (err?.code === 11000) return fail(`“${name}” already exists.`);
    throw err;
  }
  refresh();
  return { ok: true };
}

/** Active ↔ inactive (inactive: hidden from the picker, still shown on tasks). */
export async function toggleExternalPersonAction(formData) {
  const caller = await authorizeFullAccess();
  if (caller.error) return fail(caller.error);

  const person = await findExternalPerson(formData);
  if (!person) return fail("That person no longer exists.");
  await ExternalPerson.updateOne({ _id: person._id }, { $set: { active: !person.active } });
  refresh();
  return { ok: true };
}

/** Delete, only while no task uses them (else suggest deactivating). */
export async function deleteExternalPersonAction(formData) {
  const caller = await authorizeFullAccess();
  if (caller.error) return fail(caller.error);

  const person = await findExternalPerson(formData);
  if (!person) return fail("That person no longer exists.");
  const used = await externalUsage(person._id);
  if (used > 0) {
    return fail(`${used} task${used === 1 ? " uses" : "s use"} “${person.name}”, so they can't be deleted. Deactivate them instead.`);
  }
  await ExternalPerson.deleteOne({ _id: person._id });
  refresh();
  return { ok: true };
}

/** "Sync now": refresh the MSDB mirror (Related pickers) from the MSDB API. */
export async function syncMsdbNowAction() {
  const caller = await authorizeFullAccess();
  if (caller.error) return fail(caller.error);

  const result = await syncMsdbRefs({ reason: "manual" });
  refresh();
  if (result.skipped) return fail("A sync is already running. Try again in a couple of minutes.");
  if (!result.ok) return fail(`Some lists didn't sync: ${result.error}`);
  return { ok: true };
}
