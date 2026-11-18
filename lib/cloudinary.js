// Cloudinary access for avatars and task photos. SERVER ONLY: holds the API
// secret. `server-only` makes any client import a build error.
//
// The cloud is the company's shared one (several projects, near its plan limit):
// - everything lives under 9exp-studio/ (avatars/, tasks/graphic/) so Studio's
//   assets are separable;
// - uploads are already 512×512 from the browser; c_limit 512 is a safety net;
// - replaced/removed avatars are deleted (see lib/avatar.js).

import "server-only";
import { v2 as cloudinary } from "cloudinary";

export { avatarUrl } from "./avatar-url";

export const AVATAR_FOLDER = "9exp-studio/avatars";

// Our public ids: <24-hex userId>-<ms timestamp>, with or without the folder prefix
// (the prefix depends on the cloud's folder mode). deleteAvatar refuses anything
// else, so a bad value can never delete another project's asset.
const OWN_PUBLIC_ID = /^(9exp-studio\/avatars\/)?[a-f0-9]{24}-\d{13}$/;

let configured = false;

function client() {
  if (!configured) {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud_name || !api_key || !api_secret) {
      throw new Error(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local."
      );
    }
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    configured = true;
  }
  return cloudinary;
}

/**
 * Upload a prepared avatar image.
 * @param {Buffer} buffer validated image bytes
 * @param {string} userId owner's ObjectId (hex)
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export function uploadAvatar(buffer, userId) {
  const cld = client();
  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder: AVATAR_FOLDER,
        public_id: `${userId}-${Date.now()}`,
        resource_type: "image",
        overwrite: false,
        // Incoming transformation: the stored original is never larger than 512×512.
        transformation: [{ crop: "limit", width: 512, height: 512 }],
      },
      (error, result) => {
        if (error || !result?.secure_url || !result?.public_id) {
          reject(new Error(`Avatar upload failed${error?.message ? `: ${error.message}` : ""}`));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// ── Task photos (Graphic Step 2) ────────────────────────────────────────────
// Up to 10 MB each, so the browser uploads straight to Cloudinary with a
// SIGNATURE made here (server action, after auth): the folder, public id, allowed
// formats and timestamp are fixed by the server and covered by the signature, so
// the browser can't upload anywhere else. Bytes never pass through our server
// (server actions have a small body limit).
//
// Public ids: 9exp-studio/tasks/graphic/<24-hex uploader id>-<ms>-<6 hex>, with
// or without the folder prefix (folder mode), like avatars.
export const TASK_PHOTO_FOLDER = "9exp-studio/tasks/graphic";
const TASK_PHOTO_ID = /^(?:9exp-studio\/tasks\/graphic\/)?([a-f0-9]{24})-\d{13}-[a-f0-9]{6}$/;
export const TASK_PHOTO_FORMATS = "jpg,png,webp";

/** Is this one of our task-photo public ids (optionally: uploaded by `userId`)? */
export function isOwnTaskPhotoId(publicId, userId = null) {
  const m = typeof publicId === "string" ? TASK_PHOTO_ID.exec(publicId) : null;
  return !!m && (!userId || m[1] === String(userId));
}

/** A delivery URL of OUR cloud for this public id (rejects anything else). */
export function isTaskPhotoUrl(url, publicId) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || typeof url !== "string" || typeof publicId !== "string") return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "res.cloudinary.com" &&
      u.pathname.startsWith(`/${cloud}/image/upload/`) &&
      u.pathname.includes(publicId.replace(/^9exp-studio\/tasks\/graphic\//, ""))
    );
  } catch {
    return false;
  }
}

/**
 * Signed params for ONE direct browser upload of a task photo by `userId`.
 * @returns {{ uploadUrl: string, fields: Record<string, string> }}
 */
export function signTaskPhotoUpload(userId) {
  const cld = client();
  const { cloud_name, api_key, api_secret } = cld.config();
  const rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  const params = {
    folder: TASK_PHOTO_FOLDER,
    public_id: `${userId}-${Date.now()}-${rand}`,
    allowed_formats: TASK_PHOTO_FORMATS,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const signature = cld.utils.api_sign_request(params, api_secret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
    fields: { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key, signature },
  };
}

/** Delete a task photo. Best-effort: never throws; refuses ids that aren't ours. */
export async function deleteTaskPhoto(publicId) {
  if (!isOwnTaskPhotoId(publicId)) {
    if (publicId) console.error("[cloudinary] refused to delete a non-task-photo public id");
    return false;
  }
  try {
    const res = await client().uploader.destroy(publicId, { resource_type: "image" });
    if (res?.result === "ok" || res?.result === "not found") return true;
    console.error(`[cloudinary] destroy ${publicId} returned: ${res?.result ?? "unknown"}`);
    return false;
  } catch (err) {
    console.error(`[cloudinary] destroy ${publicId} failed: ${err?.message ?? "unknown error"}`);
    return false;
  }
}

/**
 * Delete an avatar. Best-effort: never throws; logs unexpected results (no secrets).
 * @returns {Promise<boolean>} true when Cloudinary says "ok" or "not found"
 */
export async function deleteAvatar(publicId) {
  if (typeof publicId !== "string" || !OWN_PUBLIC_ID.test(publicId)) {
    if (publicId) console.error("[cloudinary] refused to delete a non-avatar public id");
    return false;
  }
  try {
    const res = await client().uploader.destroy(publicId, { resource_type: "image" });
    if (res?.result === "ok" || res?.result === "not found") return true;
    console.error(`[cloudinary] destroy ${publicId} returned: ${res?.result ?? "unknown"}`);
    return false;
  } catch (err) {
    console.error(`[cloudinary] destroy ${publicId} failed: ${err?.message ?? "unknown error"}`);
    return false;
  }
}
