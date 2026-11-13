// Cloudinary access for avatars. SERVER ONLY: holds the API secret.
// `server-only` makes any client import a build error.
//
// The cloud is the company's shared one (several projects, near its plan limit):
// - everything lives under 9exp-studio/avatars/ so Studio's assets are separable;
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
