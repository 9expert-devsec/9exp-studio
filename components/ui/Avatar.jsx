import Image from "next/image";
import { avatarUrl } from "@/lib/avatar-url";
import { initialsOf } from "@/lib/format";

// Profile picture, or initials (navy on brand-500) when there is none.
// Sizes used: 24 (header pill), 36 (menu, tables), 96 (profile, edit modal).
// `unoptimized`: Cloudinary already resizes/encodes (c_fill,g_face,2×,f_auto,q_auto);
// routing it through Next's optimizer would only add cost.
// Corner radius follows the Figma pill avatar (10px at 24px ≈ 0.42 × size).
// No hooks, so it renders from server and client components.
export default function Avatar({ name = "", url, size = 36, className = "" }) {
  const src = avatarUrl(url, size);
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.42) };

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        unoptimized
        style={style}
        className={`shrink-0 bg-track object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      className={`flex shrink-0 items-center justify-center bg-brand-500 font-semibold leading-none text-navy ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
