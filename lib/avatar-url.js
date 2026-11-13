// Avatar delivery URLs (pure; safe in client and server code).
//
// Avatars are only ever delivered through small Cloudinary transformations, and
// only at these display sizes, so each picture has at most three derived versions
// (the cloud is shared and near its plan limit).
//   c_fill,g_face,w_<2×>,h_<2×>,f_auto,q_auto  (2× for retina)
// Kept separate from lib/cloudinary.js, which is server-only (it holds the API secret).

export const AVATAR_SIZES = [24, 36, 96];

const UPLOAD_SEGMENT = "/image/upload/";

export function avatarUrl(url, size) {
  if (typeof url !== "string" || !url.startsWith("https://res.cloudinary.com/")) return null;
  const at = url.indexOf(UPLOAD_SEGMENT);
  if (at === -1) return null;

  // Snap to the nearest allowed size so no other derivatives get created.
  const snapped = AVATAR_SIZES.reduce((best, s) =>
    Math.abs(s - size) < Math.abs(best - size) ? s : best
  );
  const px = snapped * 2;
  const transform = `c_fill,g_face,w_${px},h_${px},f_auto,q_auto/`;
  const head = url.slice(0, at + UPLOAD_SEGMENT.length);
  return head + transform + url.slice(at + UPLOAD_SEGMENT.length);
}
