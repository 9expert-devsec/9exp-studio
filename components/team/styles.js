// Team Management class strings, built on the design-system tokens and primitives.

import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

// Edge-to-edge card for tables (overflow scrolls inside the card, never the page).
export const card = cardClass({ padded: false });

export const label = "mb-1.5 block text-sm font-medium text-fg";

export const input =
  "min-h-11 w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-base text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-card-inset disabled:text-fg-muted sm:text-sm";

export const btnPrimary = buttonClass("primary");
export const btnSecondary = buttonClass("secondary");
export const btnDanger = buttonClass("danger");

// Small row-action button (icon + label).
export const btnRow =
  "inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-fg-muted";

export const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted";

export const td = "px-4 py-3 align-middle text-sm";

export const errorText = "text-sm text-danger";

const pillBase = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export const pill = {
  brand: `${pillBase} bg-accent-soft text-accent-fg`,
  green: `${pillBase} bg-success/15 text-success`,
  amber: `${pillBase} bg-warning/15 text-warning`,
  slate: `${pillBase} bg-track text-fg-muted`,
};
