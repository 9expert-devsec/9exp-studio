// The ONE platform icon component + registry: stored icon key (lib/tasks/options.js
// PLATFORM_MARKS) → react-icons brand logo in its own colour, no tile behind it.
// Brand colours are runtime values (inline style); TikTok and X use the theme
// foreground (their black would vanish on the dark theme), Internal/Website/Other
// the muted text colour (static classes). Decorative: the label next to it carries
// the meaning. No hooks: renders from server and client components.

import { FaBuilding, FaCircleQuestion, FaFacebook, FaGlobe, FaInstagram, FaLine, FaTiktok, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { SiShopee } from "react-icons/si";

const PLATFORM_ICONS = {
  youtube: { Icon: FaYoutube, color: "#FF0000" },
  facebook: { Icon: FaFacebook, color: "#1877F2" },
  tiktok: { Icon: FaTiktok, className: "text-fg" },
  instagram: { Icon: FaInstagram, color: "#E4405F" },
  line: { Icon: FaLine, color: "#06C755" },
  x: { Icon: FaXTwitter, className: "text-fg" },
  shopee: { Icon: SiShopee, color: "#EE4D2D" }, // Simple Icons: FA6 has no Shopee logo
  internal: { Icon: FaBuilding, className: "text-fg-muted" },
  website: { Icon: FaGlobe, className: "text-fg-muted" },
  other: { Icon: FaCircleQuestion, className: "text-fg-muted" },
};

export default function PlatformIcon({ icon, size = 18, className = "" }) {
  const { Icon, color, className: tone = "" } = PLATFORM_ICONS[icon] ?? PLATFORM_ICONS.other;
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      size={size}
      style={color ? { color } : undefined}
      className={`shrink-0 ${tone} ${className}`}
    />
  );
}
