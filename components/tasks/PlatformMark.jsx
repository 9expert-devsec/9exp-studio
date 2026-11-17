// Small coloured platform mark (no logo files): a rounded square in the brand
// colour (inline style: runtime value) with a one-character glyph. Decorative; the
// label next to it carries the meaning. No hooks: renders from server and client.

import { platformMark } from "@/lib/tasks/options";

export default function PlatformMark({ icon, size = 18, className = "" }) {
  const m = platformMark(icon);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[5px] font-bold leading-none text-white ${className}`}
      style={{ width: size, height: size, backgroundColor: m.color, fontSize: Math.round(size * 0.6) }}
    >
      {m.glyph}
    </span>
  );
}
