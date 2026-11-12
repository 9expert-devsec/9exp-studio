"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Password field with a show/hide toggle (same behaviour as /login).
// 16px text below sm (no iOS focus zoom); field and toggle are ≥44px tall.
export default function PasswordInput({ id, label, describedBy, className = "", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={describedBy}
          className={`min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-white sm:text-sm ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:text-white/50 dark:hover:text-white"
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
