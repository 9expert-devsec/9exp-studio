import Link from "next/link";

// No hooks here, so this renders from both server and client components.
// Figma nav item: 44px tall, radius 12, padding 8/12, gap 12, 20px icon,
// 14px/20px medium label in nav-fg, truncating with an ellipsis.

const base =
  "flex h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium leading-5 transition-colors";

export default function NavItem({ item, active = false, onNavigate }) {
  const Icon = item.icon;

  // Not built yet: same look as a normal item, but not a link (and never a 404).
  if (!item.href) {
    return (
      <li>
        <span
          aria-disabled="true"
          title="Coming soon"
          className={`${base} cursor-not-allowed text-nav-fg`}
        >
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`${base} focus-visible:outline-2 focus-visible:outline-brand-500 ${
          active
            ? "rounded-[9px] bg-nav-active-bg text-nav-fg-active"
            : "text-nav-fg hover:bg-white/[0.04]"
        }`}
      >
        <Icon className={`size-5 shrink-0 ${active ? "text-brand-500" : ""}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    </li>
  );
}
