"use client";

import { startTransition, useActionState, useState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import PasswordInput from "@/components/ui/PasswordInput";
import { changePasswordAction } from "./actions";

const MIN_LENGTH = 10;
const MAX_BYTES = 72;
const byteLength = (s) => new TextEncoder().encode(s).length;

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [state, formAction, isPending] = useActionState(async (prev, formData) => {
    const result = await changePasswordAction(prev, formData);
    if (result?.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    return result;
  }, null);

  // Submit via onSubmit (not the `action` prop) so React doesn't auto-reset the
  // fields when the server returns an error.
  const onSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  };

  // Client-side checks are UX only; the server action re-validates everything.
  const longEnough = newPassword.length >= MIN_LENGTH;
  const tooLong = byteLength(newPassword) > MAX_BYTES;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <PasswordInput
        id="currentPassword"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />

      <div>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          label="New password"
          autoComplete="new-password"
          required
          describedBy="newPassword-hint"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p
          id="newPassword-hint"
          aria-live="polite"
          className={`mt-1.5 flex items-center gap-1.5 text-xs ${
            tooLong
              ? "text-red-600 dark:text-red-400"
              : longEnough
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {longEnough && !tooLong && <CircleCheck className="size-3.5" aria-hidden="true" />}
          {tooLong ? "Too long (max 72 bytes)" : "At least 10 characters"}
        </p>
      </div>

      <div>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          required
          describedBy="confirmPassword-hint"
          aria-invalid={mismatch || undefined}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <p
          id="confirmPassword-hint"
          aria-live="polite"
          className="mt-1.5 min-h-4 text-xs text-red-600 dark:text-red-400"
        >
          {mismatch ? "Passwords do not match." : ""}
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-brand-500 sm:self-start sm:text-sm"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? "Updating…" : "Update password"}
      </button>

      <p
        aria-live="polite"
        className={`min-h-5 text-sm ${
          state?.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
      >
        {state?.ok ? "Password updated." : (state?.error ?? "")}
      </p>
    </form>
  );
}
