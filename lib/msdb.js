// MSDB ("nine_expert") — READ-ONLY. Server only.
//
// A SEPARATE Mongoose connection (never the studio connection), cached on
// `global` like lib/db.js. This module only ever calls find / findOne on the
// native collections: no insert / update / delete / index calls, and no models
// (so Mongoose can't autoIndex or write anything there).
//
// Env: MSDB_URI (a read-only user is recommended) — falls back to MONGODB_URI;
//      MSDB_DB_NAME — defaults to "nine_expert".
//
// Collections + fields come from the master-data app's models
// (9exp-master-data/src/models: PublicCourse, OnlineCourse, Program, Skill; no
// explicit collection names, so Mongoose's pluralised defaults apply).

import "server-only";
import mongoose from "mongoose";
import { escapeRegex } from "@/lib/projects/rules";

const MAX_RESULTS = 20;

/** kind → collection + the code/name fields used. `filter` = only usable records. */
export const MSDB_SOURCES = {
  public: {
    collection: "publiccourses",
    code: "course_id",
    name: "course_name",
    // Public (classroom) courses; in-house-only records have course_type_public: false.
    filter: { course_type_public: { $ne: false } },
  },
  online: { collection: "onlinecourses", code: "o_course_id", name: "o_course_name", filter: {} },
  program: { collection: "programs", code: "program_id", name: "program_name", filter: {} },
  skill: { collection: "skills", code: "skill_id", name: "skill_name", filter: {} },
};
export const COURSE_KINDS = ["public", "online"];

let cached = global._msdb;
if (!cached) cached = global._msdb = { conn: null, promise: null };

async function msdb() {
  const uri = process.env.MSDB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MSDB_URI / MONGODB_URI is not set.");
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .createConnection(uri, {
        dbName: process.env.MSDB_DB_NAME || "nine_expert",
        bufferCommands: false,
        autoIndex: false,
        autoCreate: false,
        readPreference: "secondaryPreferred",
      })
      .asPromise();
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}

const collectionFor = async (kind) => (await msdb()).db.collection(MSDB_SOURCES[kind].collection);

/** A record → the snapshot stored on tasks: { source, kind, id, code, name }. */
function toSnapshot(kind, doc) {
  const src = MSDB_SOURCES[kind];
  return {
    source: "msdb",
    kind,
    id: doc._id.toString(),
    code: String(doc[src.code] ?? ""),
    name: String(doc[src.name] ?? ""),
  };
}

async function search(kind, q) {
  const src = MSDB_SOURCES[kind];
  const term = String(q ?? "").trim().slice(0, 100);
  const filter = { ...src.filter };
  if (term) {
    const re = new RegExp(escapeRegex(term), "i");
    filter.$or = [{ [src.name]: re }, { [src.code]: re }];
  }
  const col = await collectionFor(kind);
  const docs = await col
    .find(filter, { projection: { [src.code]: 1, [src.name]: 1 } })
    .sort({ [src.name]: 1 })
    .limit(MAX_RESULTS)
    .toArray();
  return docs.map((d) => toSnapshot(kind, d));
}

/** @param {{ q: string, kind: "public" | "online" }} args */
export const searchCourses = ({ q, kind }) => search(COURSE_KINDS.includes(kind) ? kind : "public", q);
export const searchPrograms = (q) => search("program", q);
export const searchSkills = (q) => search("skill", q);

/** One record by _id as a snapshot, or null (unknown kind / bad id / not found). */
export async function getMsdbSnapshot(kind, id) {
  const src = MSDB_SOURCES[kind];
  if (!src || typeof id !== "string" || !mongoose.isValidObjectId(id)) return null;
  const col = await collectionFor(kind);
  const doc = await col.findOne(
    { _id: new mongoose.Types.ObjectId(id), ...src.filter },
    { projection: { [src.code]: 1, [src.name]: 1 } }
  );
  return doc ? toSnapshot(kind, doc) : null;
}
