import Image from "next/image";

// Mark is 301×402; heights below keep that aspect ratio.
const SIZES = {
  sm: { markH: 28, divider: "h-7", text: "text-sm", triangle: 7, gap: "gap-2" },
  md: { markH: 40, divider: "h-10", text: "text-lg", triangle: 9, gap: "gap-3" },
  lg: { markH: 56, divider: "h-14", text: "text-2xl", triangle: 12, gap: "gap-4" },
};

const MARK_RATIO = 301 / 402;

export default function StudioLogo({ size = "md", className = "" }) {
  const s = SIZES[size] ?? SIZES.md;
  const markW = Math.round(s.markH * MARK_RATIO);

  return (
    <div
      role="img"
      aria-label="9Expert Studio"
      className={`inline-flex items-center ${s.gap} ${className}`}
    >
      <Image
        src="/brand/9-mark.png"
        alt=""
        aria-hidden="true"
        width={markW}
        height={s.markH}
        priority={size === "lg"}
      />
      <span aria-hidden="true" className={`w-px ${s.divider} bg-white/30`} />
      <span
        aria-hidden="true"
        className={`flex flex-col font-en font-bold leading-[0.95] tracking-tight text-white ${s.text}`}
      >
        <span>9Expert</span>
        <span className="inline-flex items-center gap-1.5">
          studio
          <svg
            viewBox="0 0 10 12"
            width={s.triangle}
            height={Math.round(s.triangle * 1.2)}
            className="animate-logo-pulse text-brand-500 motion-reduce:animate-none"
          >
            <path d="M0 0 L10 6 L0 12 Z" fill="currentColor" />
          </svg>
        </span>
      </span>
    </div>
  );
}
