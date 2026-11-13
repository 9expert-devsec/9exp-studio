import Link from "next/link";

// Round header control (Figma: 29px, fully rounded, `control` surface, 15px muted icon).
// Light theme adds a 1px line border (control-line is transparent in dark).
// The visible circle is 29px; an invisible ::after extends the tap target to 44px tall.
const cls =
  "relative inline-flex size-[29px] shrink-0 items-center justify-center rounded-full border border-control-line bg-control text-fg-muted transition-colors after:absolute after:-inset-x-[3px] after:-inset-y-[7.5px] after:content-[''] hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-fg-muted";

export default function IconButton({ icon: Icon, label, href, className = "", type = "button", ...props }) {
  const content = <Icon className="size-[15px]" aria-hidden="true" />;

  if (href) {
    return (
      <Link href={href} aria-label={label} title={props.title ?? label} className={`${cls} ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} aria-label={label} className={`${cls} ${className}`} {...props}>
      {content}
    </button>
  );
}
