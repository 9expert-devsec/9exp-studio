"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Password field with a show/hide toggle (same behaviour as /login).
// 16px text below sm (no iOS focus zoom); field and toggle are ≥44px tall.
//
// variant:
//   "default" – design-system tokens (app shell, modals)
//   "auth"    – the /login field look, for the fixed-dark auth card (/first-login)
const STYLES = {
  default: {
    label: "mb-1.5 block text-sm font-medium text-fg",
    input:
      "min-h-11 w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 pr-11 text-base text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:text-sm",
    toggle: "rounded-r-[10px] text-fg-muted hover:text-fg",
  },
  auth: {
    label: "mb-1.5 block text-sm font-medium text-white/80",
    input:
      "min-h-11 w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3.5 py-2.5 pr-11 text-base text-white outline-none transition-colors placeholder:text-white/40 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:text-sm",
    toggle: "rounded-r-lg text-white/50 hover:text-white focus-visible:text-white",
  },
};

export default function PasswordInput({
  id,
  label,
  describedBy,
  variant = "default",
  className = "",
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const s = STYLES[variant] ?? STYLES.default;

  return (
    <div>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={describedBy}
          className={`${s.input} ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${s.toggle}`}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
