// Interim Team Management class strings (the Figma UI will replace these).

export const card =
  "rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-dark";

export const label = "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200";

export const input =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:disabled:bg-white/[0.03] dark:disabled:text-slate-400 sm:text-sm";

const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `${btn} bg-brand-500 text-white hover:bg-brand-600 disabled:hover:bg-brand-500`;

export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5`;

export const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600`;

// Small row-action button (icon + label).
export const btnRow =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white dark:disabled:hover:text-slate-300";

export const th =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

export const td = "px-4 py-3 align-middle text-sm";

export const errorText = "text-sm text-red-600 dark:text-red-400";

const pillBase = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export const pill = {
  brand: `${pillBase} bg-brand-500/15 text-brand-700 dark:text-brand-300`,
  green: `${pillBase} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`,
  amber: `${pillBase} bg-amber-500/15 text-amber-700 dark:text-amber-300`,
  slate: `${pillBase} bg-slate-500/15 text-slate-600 dark:text-slate-300`,
};
