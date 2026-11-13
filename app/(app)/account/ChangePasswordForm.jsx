"use client";

import { startTransition, useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import PasswordInput from "@/components/ui/PasswordInput";
import { PasswordMatch, PasswordRules } from "@/components/ui/PasswordRules";
import { changePasswordAction } from "./actions";

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

  // UX only; the server action re-validates with the same rules (lib/password.js).
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
        <PasswordRules id="newPassword-hint" password={newPassword} />
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
        <PasswordMatch id="confirmPassword-hint" password={newPassword} confirm={confirmPassword} />
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
