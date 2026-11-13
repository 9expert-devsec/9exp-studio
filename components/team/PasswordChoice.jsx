"use client";

import PasswordInput from "@/components/ui/PasswordInput";
import { PasswordMatch, PasswordRules } from "@/components/ui/PasswordRules";
import { validateNewPassword } from "@/lib/password";

// "Generate one" (default) | "Set a password" radio group, used by the Add-account
// and Reset-password dialogs. Controlled: the parent owns mode/password/confirm.
// Client checks are UX only; the server re-validates with the same lib/password.js.

/** Same rule and wording as the server (lib/password.js validateNewPassword). */
export function passwordChoiceError(mode, password, confirm) {
  if (mode !== "set") return null;
  return validateNewPassword(password, confirm);
}

export default function PasswordChoice({ idPrefix, mode, onModeChange, password, onPassword, confirm, onConfirm }) {
  const option = (value, label, hint) => (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-card-inset px-3 py-2.5 has-[:checked]:border-brand-500">
      <input
        type="radio"
        name={`${idPrefix}-passwordMode`}
        value={value}
        checked={mode === value}
        onChange={() => onModeChange(value)}
        className="mt-0.5 size-4 accent-brand-500"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-fg">{label}</span>
        <span className="text-xs text-fg-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-medium text-fg">Initial password</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {option("generate", "Generate one", "Shown once after saving.")}
        {option("set", "Set a password", "You type it and share it.")}
      </div>

      {mode === "set" && (
        <div className="flex flex-col gap-3">
          <div>
            <PasswordInput
              id={`${idPrefix}-password`}
              label="Password"
              autoComplete="new-password"
              required
              describedBy={`${idPrefix}-password-hint`}
              value={password}
              onChange={(e) => onPassword(e.target.value)}
            />
            <PasswordRules id={`${idPrefix}-password-hint`} password={password} />
          </div>
          <div>
            <PasswordInput
              id={`${idPrefix}-password-confirm`}
              label="Confirm password"
              autoComplete="new-password"
              required
              describedBy={`${idPrefix}-confirm-hint`}
              aria-invalid={(confirm.length > 0 && confirm !== password) || undefined}
              value={confirm}
              onChange={(e) => onConfirm(e.target.value)}
            />
            <PasswordMatch id={`${idPrefix}-confirm-hint`} password={password} confirm={confirm} />
          </div>
        </div>
      )}

      <p className="text-xs text-fg-muted">
        The person must change this password the first time they sign in.
      </p>
    </fieldset>
  );
}
