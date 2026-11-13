// Design-system card: bg-card, 1px line border, radius 24 (size="sm": 18).
// `padded={false}` for edge-to-edge content such as tables.

const RADIUS = { md: "rounded-[24px]", sm: "rounded-[18px]" };

export function cardClass({ size = "md", padded = true, className = "" } = {}) {
  return `border border-line bg-card ${RADIUS[size] ?? RADIUS.md} ${padded ? "p-4 sm:p-5" : ""} ${className}`;
}

export default function Card({ as: Tag = "div", size, padded, className, children, ...props }) {
  return (
    <Tag className={cardClass({ size, padded, className })} {...props}>
      {children}
    </Tag>
  );
}
