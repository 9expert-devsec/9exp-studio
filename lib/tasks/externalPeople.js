// Saved external presenters (round 38) — DB side. Server only. Pure rules:
// lib/tasks/production.js.

import "server-only";
import mongoose from "mongoose";
import { cleanExternalName, externalNameKey } from "@/lib/tasks/production";
import ExternalPerson from "@/models/ExternalPerson";
import User from "@/models/User";

const idOf = (v) => (v ? String(v) : "");

/**
 * Turn posted new names ({ kind: "external", name }) into ExternalPerson ids,
 * reusing the person with the same nameKey (atomic upsert: never a duplicate,
 * also under concurrent saves). Entries that resolve to the same person are
 * merged. Returns the stored presenters list ({ kind, id: ObjectId }).
 */
export async function resolvePresenters(presenters, createdBy) {
  const out = [];
  const seen = new Set();
  for (const p of presenters ?? []) {
    let entry = p;
    if (p.kind === "external" && !p.id) {
      const name = cleanExternalName(p.name);
      const nameKey = externalNameKey(name);
      let doc;
      try {
        doc = await ExternalPerson.findOneAndUpdate(
          { nameKey },
          { $setOnInsert: { name, nameKey, note: "", active: true, createdBy } },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        ).lean();
      } catch (err) {
        // Two saves inserting the same new name at once: the loser reads the winner.
        if (err?.code !== 11000) throw err;
        doc = await ExternalPerson.findOne({ nameKey }).lean();
      }
      entry = { kind: "external", id: doc._id };
    }
    const key = `${entry.kind}:${idOf(entry.id)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: entry.kind, id: new mongoose.Types.ObjectId(idOf(entry.id)) });
  }
  return out;
}

/**
 * Display names for people keys ("user:<id>" / "external:<id>"), e.g. for the
 * activity line. Unknown → "Unknown".
 * @returns {Promise<Map<string, string>>}
 */
export async function peopleNames(keys) {
  const userIds = [];
  const extIds = [];
  for (const k of new Set(keys)) {
    const [kind, id] = k.split(":");
    if (!mongoose.isValidObjectId(id)) continue;
    (kind === "external" ? extIds : userIds).push(id);
  }
  const [users, externals] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).select("name").lean() : [],
    extIds.length ? ExternalPerson.find({ _id: { $in: extIds } }).select("name").lean() : [],
  ]);
  return new Map([
    ...users.map((u) => [`user:${idOf(u._id)}`, u.name]),
    ...externals.map((x) => [`external:${idOf(x._id)}`, x.name]),
  ]);
}

/** Externals by id (any state) → Map id → { id, name, active }. */
export async function loadExternalPeople(ids) {
  const list = [...new Set((ids ?? []).map(idOf))].filter((id) => mongoose.isValidObjectId(id));
  if (!list.length) return new Map();
  const docs = await ExternalPerson.find({ _id: { $in: list } }).select("name active").lean();
  return new Map(docs.map((x) => [idOf(x._id), { id: idOf(x._id), name: x.name, active: !!x.active }]));
}

/** Picker list: active externals, plus inactive ones `keepIds` already uses. Name order. */
export async function externalPeopleForPicker(keepIds = []) {
  const keep = keepIds.map(idOf).filter((id) => mongoose.isValidObjectId(id));
  const docs = await ExternalPerson.find({ $or: [{ active: true }, ...(keep.length ? [{ _id: { $in: keep } }] : [])] })
    .select("name active")
    .sort({ name: 1 })
    .limit(500)
    .lean();
  return docs.map((x) => ({ id: idOf(x._id), name: x.name, active: !!x.active }));
}
