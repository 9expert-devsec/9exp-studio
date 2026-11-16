// Design-system buttons.
// primary   = Figma "CREATE PROJECT": brand-500 fill, navy text, radius 10, semibold uppercase.
// secondary = `control` surface (light adds a 1px line border).
// danger    = destructive confirm (not in Figma yet; same shape as primary).
// danger-outline = destructive entry point (opens a confirm).

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS = {
  primary: `${base} uppercase tracking-wide bg-brand-500 text-navy hover:bg-brand-600 disabled:hover:bg-brand-500`,
  secondary: `${base} border border-control-line bg-control text-fg hover:bg-card-inset`,
  danger: `${base} uppercase tracking-wide bg-danger-solid text-white hover:brightness-110 disabled:hover:brightness-100`,
  // Outlined (line border, transparent fill): "Back to contents", "Edit content".
  outline: `${base} border border-line text-fg hover:bg-card-inset`,
  // Destructive entry point that opens a confirm (e.g. "Delete content").
  "danger-outline": `${base} border border-danger/40 text-danger hover:bg-danger/10`,
};

export function buttonClass(variant = "primary", className = "") {
  return `${VARIANTS[variant] ?? VARIANTS.primary} ${className}`;
}

export default function Button({
  variant = "primary",
  icon: Icon,
  type = "button",
  className = "",
  children,
  ...props
}) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...props}>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
