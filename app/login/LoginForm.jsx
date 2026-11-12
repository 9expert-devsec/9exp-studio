"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import StudioLogo from "@/components/brand/StudioLogo";
import { loginAction } from "./actions";

// UI strings in one place so they can be translated later.
const STRINGS = {
  emailLabel: "Email",
  emailPlaceholder: "you@9expert.co.th",
  passwordLabel: "Password",
  passwordPlaceholder: "Password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  submit: "Sign in",
  submitting: "Signing in…",
  adminNote: "Accounts are created by an administrator.",
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, {
    error: null,
  });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="mb-4 flex justify-center">
        <StudioLogo size="lg" />
      </div>

      <div>
        <label htmlFor="email" className="sr-only">
          {STRINGS.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder={STRINGS.emailPlaceholder}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="sr-only">
          {STRINGS.passwordLabel}
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder={STRINGS.passwordPlaceholder}
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? STRINGS.hidePassword : STRINGS.showPassword}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-white/50 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-brand-500"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? STRINGS.submitting : STRINGS.submit}
      </button>

      {/* Error line is always in the DOM (for aria-live) but takes no space when empty,
          so the note sits one field-gap below the button. */}
      <div className="flex flex-col">
        <p aria-live="polite" className="text-center text-sm text-red-400 not-empty:mb-2">
          {state?.error ?? ""}
        </p>
        <p className="text-center text-xs text-white/40">{STRINGS.adminNote}</p>
      </div>
    </form>
  );
}
