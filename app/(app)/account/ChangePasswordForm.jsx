"use client";

import { startTransition, useActionState, useState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
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
              ? "text-danger"
              : longEnough
                ? "text-success"
                : "text-fg-muted"
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
          className="mt-1.5 min-h-4 text-xs text-danger"
        >
          {mismatch ? "Passwords do not match." : ""}
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={buttonClass("primary", "sm:self-start")}
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? "Updating…" : "Update password"}
      </button>

      <p
        aria-live="polite"
        className={`min-h-5 text-sm ${
          state?.ok ? "text-success" : "text-danger"
        }`}
      >
        {state?.ok ? "Password updated." : (state?.error ?? "")}
      </p>
    </form>
  );
}
