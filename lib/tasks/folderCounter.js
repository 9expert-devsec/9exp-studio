// Folder ID counters — DB side. Server only. Pure format/month rules live in
// lib/tasks/folderId.js.

import "server-only";
import dbConnect from "@/lib/db";
import {
  bangkokYYMM,
  folderCounterKey,
  folderIdPattern,
  folderSuffixForType,
  formatFolderId,
  issuingFolderKinds,
  parseFolderId,
} from "@/lib/tasks/folderId";
import FolderCounter from "@/models/FolderCounter";
import Task from "@/models/Task";
import TaskFolder from "@/models/TaskFolder";

export const NEXT_NUMBER_MAX = 99999;

/**
 * Issue the next Folder ID for a task of `type` created at `now` (Bangkok month),
 * or null when the type issues none. Atomic $inc; if the task insert later fails,
 * that number is simply skipped (never reused).
 */
export async function issueFolderId(type, now = new Date()) {
  const suffix = folderSuffixForType(type);
  if (!suffix) return null;
  await dbConnect();
  const yymm = bangkokYYMM(now);
  const counter = await FolderCounter.findOneAndUpdate(
    { key: folderCounterKey(yymm, suffix) },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: false }
  ).lean();
  return formatFolderId(yymm, counter.seq, suffix);
}

/**
 * "New Folder" (round 36): issue the next Folder ID for `type` AND create its
 * TaskFolder (project + the shared name/location). Returns the folderId, or null
 * when the type has no folders. The caller links the task; if that insert fails
 * it calls discardFolder() (the number itself is skipped, never reused).
 */
export async function createTaskFolder(type, { project, name = "", location = "", createdBy = null }, now = new Date()) {
  const folderId = await issueFolderId(type, now);
  if (!folderId) return null;
  await TaskFolder.create({ folderId, suffix: parseFolderId(folderId).suffix, project, name, location, createdBy });
  return folderId;
}

/** Remove a folder created for a task that then failed to insert (best effort). */
export async function discardFolder(folderId) {
  if (!folderId) return;
  try {
    await TaskFolder.deleteOne({ folderId });
  } catch {
    /* an empty folder left behind is harmless */
  }
}

/** Highest sequence the SYSTEM issued (on a task or a folder) for this month + suffix; 0 if none. */
async function highestIssued(yymm, suffix) {
  const re = folderIdPattern(yymm, suffix);
  const [tasks, folders] = await Promise.all([
    Task.find({ folderId: re }).select("folderId").lean(),
    TaskFolder.find({ folderId: re }).select("folderId").lean(),
  ]);
  return [...tasks, ...folders].reduce((max, d) => Math.max(max, Number(re.exec(d.folderId)?.[1] ?? 0)), 0);
}

/**
 * Admin panel: for the current Bangkok month and each issuing suffix — the last
 * number used (counter), the highest the system issued, and the next ID.
 */
export async function loadFolderIdPanel(now = new Date()) {
  await dbConnect();
  const yymm = bangkokYYMM(now);
  return Promise.all(
    issuingFolderKinds().map(async (k) => {
      const [counter, issued] = await Promise.all([
        FolderCounter.findOne({ key: folderCounterKey(yymm, k.suffix) }).select("seq").lean(),
        highestIssued(yymm, k.suffix),
      ]);
      const last = Math.max(counter?.seq ?? 0, 0);
      return {
        suffix: k.suffix,
        label: k.label,
        yymm,
        lastNumber: last,
        lastId: last > 0 ? formatFolderId(yymm, last, k.suffix) : null,
        highestIssued: issued,
        nextNumber: last + 1,
        nextId: formatFolderId(yymm, last + 1, k.suffix),
      };
    })
  );
}

/**
 * Set the NEXT number for this month + suffix (seq = next − 1). Rejected when it
 * would re-issue a number the system already gave out (next must be > the
 * highest issued). Caller authorizes (Superadmin) first.
 * @returns {Promise<{ ok: true, nextId: string } | { ok: false, error: string }>}
 */
export async function setNextFolderNumber(suffix, next, now = new Date()) {
  if (!issuingFolderKinds().some((k) => k.suffix === suffix)) return { ok: false, error: "Unknown folder type." };
  if (!Number.isInteger(next) || next < 1 || next > NEXT_NUMBER_MAX) {
    return { ok: false, error: `Enter a whole number from 1 to ${NEXT_NUMBER_MAX}.` };
  }
  await dbConnect();
  const yymm = bangkokYYMM(now);
  const issued = await highestIssued(yymm, suffix);
  if (next <= issued) {
    return {
      ok: false,
      error: `The system already issued ${formatFolderId(yymm, issued, suffix)}. The next number must be ${issued + 1} or higher.`,
    };
  }
  await FolderCounter.updateOne({ key: folderCounterKey(yymm, suffix) }, { $set: { seq: next - 1 } }, { upsert: true });
  return { ok: true, nextId: formatFolderId(yymm, next, suffix) };
}
