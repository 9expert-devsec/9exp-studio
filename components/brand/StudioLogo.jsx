import Image from "next/image";

// Mark is 301×402; heights below keep that aspect ratio.
const SIZES = {
  sm: { markH: 28, divider: "h-7", text: "text-sm", gap: "gap-2" },
  md: { markH: 40, divider: "h-10", text: "text-lg", gap: "gap-3" },
  lg: { markH: 56, divider: "h-14", text: "text-2xl", gap: "gap-4" },
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
        <span>
          studio
          {/* Play-mark: rounded right-pointing triangle, sized in em so it tracks the
              wordmark at every size. Inline-block + baseline alignment puts its bottom
              on the text baseline; 0.32em tall keeps its top below the x-height. */}
          <svg
            viewBox="0 0 28 32"
            className="ml-[0.15em] inline-block h-[0.32em] w-[0.28em] origin-center animate-logo-pulse align-baseline motion-reduce:animate-none"
          >
            {/* Inner triangle + round-joined stroke (r = 3.5 of 32 ≈ 11%) fills the
                28×32 box with rounded corners. */}
            <polygon
              points="3.5,3.5 24.5,16 3.5,28.5"
              fill="#F97316"
              stroke="#F97316"
              strokeWidth="7"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </div>
  );
}
