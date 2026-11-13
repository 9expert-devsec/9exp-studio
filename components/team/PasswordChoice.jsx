"use client";

import { CircleCheck } from "lucide-react";
import PasswordInput from "@/components/ui/PasswordInput";

// "Generate one" (default) | "Set a password" radio group, used by the Add-account
// and Reset-password dialogs. Controlled: the parent owns mode/password/confirm.
// Client checks are UX only; the server re-validates with lib/password.js.

const MIN_LENGTH = 10;
const MAX_BYTES = 72;
const byteLength = (s) => new TextEncoder().encode(s).length;

/** Client-side check matching lib/password.js validateNewPassword (UX only). */
export function passwordChoiceError(mode, password, confirm) {
  if (mode !== "set") return null;
  if (byteLength(password) < MIN_LENGTH) return "Password must be at least 10 characters.";
  if (byteLength(password) > MAX_BYTES) return "Password is too long (max 72 bytes).";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export default function PasswordChoice({ idPrefix, mode, onModeChange, password, onPassword, confirm, onConfirm }) {
  const longEnough = password.length >= MIN_LENGTH;
  const tooLong = byteLength(password) > MAX_BYTES;
  const mismatch = confirm.length > 0 && confirm !== password;

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
            <p
              id={`${idPrefix}-password-hint`}
              aria-live="polite"
              className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                tooLong ? "text-danger" : longEnough ? "text-success" : "text-fg-muted"
              }`}
            >
              {longEnough && !tooLong && <CircleCheck className="size-3.5" aria-hidden="true" />}
              {tooLong ? "Too long (max 72 bytes)" : "At least 10 characters"}
            </p>
          </div>
          <div>
            <PasswordInput
              id={`${idPrefix}-password-confirm`}
              label="Confirm password"
              autoComplete="new-password"
              required
              describedBy={`${idPrefix}-confirm-hint`}
              aria-invalid={mismatch || undefined}
              value={confirm}
              onChange={(e) => onConfirm(e.target.value)}
            />
            <p id={`${idPrefix}-confirm-hint`} aria-live="polite" className="mt-1.5 min-h-4 text-xs text-danger">
              {mismatch ? "Passwords do not match." : ""}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-fg-muted">
        The person must change this password the first time they sign in.
      </p>
    </fieldset>
  );
}
