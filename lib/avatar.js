// Avatar validation + replace/remove flow, shared by the self-service actions
// (app/(app)/account/actions.js) and the superadmin actions
// (app/(app)/team/accounts/actions.js). Server only; NOT a "use server" module,
// so nothing here is a public endpoint. Callers authorize BEFORE calling.

import "server-only";
import { imageSize } from "image-size";
import { deleteAvatar, uploadAvatar } from "@/lib/cloudinary";
import User from "@/models/User";

const MAX_BYTES = 1024 * 1024; // 1 MB (the browser sends ≤ 900 KB)
const MAX_DIMENSION = 1024; // the browser sends 512×512

// Magic-byte sniffing: the declared file.type is not trusted.
function sniffType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "png";
  const ascii = (from, to) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * Read and validate the `avatar` file from a FormData.
 * @returns {Promise<{ buffer: Buffer } | { error: string }>}
 */
export async function readAvatarFile(formData) {
  const file = formData.get("avatar");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return { error: "Choose a picture first." };
  }
  if (file.size === 0) return { error: "The picture is empty." };
  if (file.size > MAX_BYTES) return { error: "The picture is too large (max 1 MB)." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) return { error: "Only JPEG, PNG or WebP pictures are allowed." };

  let dims;
  try {
    dims = imageSize(bytes);
  } catch {
    return { error: "The picture could not be read." };
  }
  if (dims?.type !== type || !dims.width || !dims.height) {
    return { error: "The picture could not be read." };
  }
  if (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) {
    return { error: `The picture is too large (max ${MAX_DIMENSION}×${MAX_DIMENSION}).` };
  }

  return { buffer: Buffer.from(bytes) };
}

/**
 * Upload first, then save; delete the OLD picture only after the save succeeds.
 * If the save fails, delete the NEW upload so it is not orphaned.
 * @returns {Promise<{ ok: true, avatarUrl: string } | { ok: false, error: string }>}
 */
export async function replaceAvatar(userId, buffer) {
  const user = await User.findById(userId).select("avatar").lean();
  if (!user) return { ok: false, error: "That account no longer exists." };
  const oldPublicId = user.avatar?.publicId;

  let uploaded;
  try {
    uploaded = await uploadAvatar(buffer, String(userId));
  } catch (err) {
    console.error(`[avatar] upload failed: ${err?.message ?? "unknown error"}`);
    return { ok: false, error: "The picture could not be uploaded. Please try again." };
  }

  try {
    const res = await User.updateOne(
      { _id: user._id },
      { $set: { avatar: { url: uploaded.url, publicId: uploaded.publicId, updatedAt: new Date() } } }
    );
    if (res.matchedCount !== 1) throw new Error("user not found during save");
  } catch (err) {
    console.error(`[avatar] save failed, removing the new upload: ${err?.message ?? "unknown error"}`);
    await deleteAvatar(uploaded.publicId);
    return { ok: false, error: "The picture could not be saved. Please try again." };
  }

  if (oldPublicId && oldPublicId !== uploaded.publicId) await deleteAvatar(oldPublicId);
  return { ok: true, avatarUrl: uploaded.url };
}

/**
 * Clear the avatar, then delete it from Cloudinary (best-effort).
 * @returns {Promise<{ ok: true, avatarUrl: null } | { ok: false, error: string }>}
 */
export async function removeAvatar(userId) {
  const user = await User.findById(userId).select("avatar").lean();
  if (!user) return { ok: false, error: "That account no longer exists." };
  const oldPublicId = user.avatar?.publicId;

  if (user.avatar) await User.updateOne({ _id: user._id }, { $unset: { avatar: 1 } });
  if (oldPublicId) await deleteAvatar(oldPublicId);
  return { ok: true, avatarUrl: null };
}
