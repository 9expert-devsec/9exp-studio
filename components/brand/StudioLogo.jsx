import Image from "next/image";

// Lockup geometry follows the Figma spec, which is drawn at a 64px wordmark.
// Every value is in em (Figma px ÷ 64), so the whole lockup scales with font-size.
// Overall box ≈ 439 × 171 Figma px (6.859em × 2.672em).
const SIZES = {
  sm: "text-[14px]",
  nav: "text-[17.5px]", // floating navbar: 6.859em × 17.5 ≈ 120 × 47 (Figma logo slot 120×50)
  md: "text-[20px]",
  lg: "text-[28px]",
};

// The wordmark always uses LINE Seed Sans TH Bold (app/fonts/LINESeedSansTH_W_Bd.woff2),
// never the body stack (which puts Google Sans first for Latin text).
// font-synthesis: none keeps the browser from faking bold if the file ever fails to load.
const WORDMARK_STYLE = {
  fontFamily: "var(--font-line-seed)",
  fontWeight: 700,
  fontSynthesis: "none",
};

export default function StudioLogo({ size = "md", className = "" }) {
  const text = SIZES[size] ?? SIZES.md;

  return (
    <div
      role="img"
      aria-label="9Expert Studio"
      className={`inline-flex items-start leading-none ${text} ${className}`}
    >
      {/* "9" mark: 123 × 130 frame, top +18 from the text block. The source PNG is
          301 × 402, so it is contained (not stretched) inside the Figma frame. */}
      <Image
        src="/brand/9-mark.png"
        alt=""
        aria-hidden="true"
        width={123}
        height={130}
        priority={size === "lg"}
        className="mt-[0.281em] h-[2.031em] w-[1.922em] shrink-0 object-contain"
      />

      {/* Divider: white, 2 × 127, top aligned with the mark; 26 after the mark, 22 before the text. */}
      <span
        aria-hidden="true"
        className="ml-[0.406em] mr-[0.344em] mt-[0.281em] h-[1.984em] w-[max(1px,0.031em)] shrink-0 bg-white"
      />

      {/* Text block: two 101px line boxes (line-height 101/64) on a 70px baseline pitch,
          so the second line is pulled up by the 31px overlap. Total height 171. */}
      <span
        aria-hidden="true"
        className="block shrink-0 whitespace-nowrap text-white"
        style={WORDMARK_STYLE}
      >
        <span className="block leading-[1.578em] tracking-[0.045em]">9Expert</span>
        <span className="-mt-[0.484em] flex items-start leading-[1.578em] tracking-normal">
          studio
          {/* Play-mark: 27 × 27 frame, 50 below the line-box top, 6 after "studio".
              Rounded triangle = inner triangle + round-joined stroke of 2r (r = 3), so
              the outer edges sit exactly on the 27 × 27 triangle (0,0)-(27,13.5)-(0,27). */}
          <svg
            viewBox="0 0 27 27"
            aria-hidden="true"
            className="ml-[0.094em] mt-[0.781em] block h-[0.422em] w-[0.422em] shrink-0 origin-center animate-logo-pulse motion-reduce:animate-none"
          >
            <polygon
              points="3,4.854 20.292,13.5 3,22.146"
              fill="#F97316"
              stroke="#F97316"
              strokeWidth="6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </div>
  );
}
