"use client";

import { useState } from "react";

// 22px icon tile for an MSDB reference (program/skill icon; courses use their
// program's). Light tile + object-contain so transparent PNG/SVG stays visible
// in both themes. No icon, or it fails to load → the same tile with the first
// two letters of the code (never a broken-image glyph). Decorative: the name
// next to it is the label. Plain <img>: Cloudinary already serves sized files
// and next.config has no remotePatterns for it.
export default function MsdbIcon({ url, code, name }) {
  const [failed, setFailed] = useState(null);
  const letters = (code || name || "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";

  if (url && failed !== url) {
    return (
      <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5 ring-1 ring-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy" decoding="async" width={18} height={18} onError={() => setFailed(url)} className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-track text-[9px] font-bold leading-none text-fg-muted ring-1 ring-line"
    >
      {letters}
    </span>
  );
}
