import Link from "next/link";

// No hooks here, so this renders from both server (TeamNavItem) and client (Sidebar).

const base =
  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors";

export default function NavItem({ item, active = false, onNavigate }) {
  const Icon = item.icon;

  if (!item.href) {
    return (
      <li>
        <span aria-disabled="true" className={`${base} cursor-not-allowed text-white/40`}>
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">{item.label}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Soon
          </span>
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
            ? "bg-brand-500/15 text-white"
            : "text-white/70 hover:bg-white/5 hover:text-white/90"
        }`}
      >
        <Icon
          className={`size-5 shrink-0 ${active ? "text-brand-500" : ""}`}
          aria-hidden="true"
        />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}
