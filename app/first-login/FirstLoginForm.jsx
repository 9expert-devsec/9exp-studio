"use client";

import { startTransition, useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import StudioLogo from "@/components/brand/StudioLogo";
import { buttonClass } from "@/components/ui/Button";
import PasswordInput from "@/components/ui/PasswordInput";
import { PasswordMatch, PasswordRules } from "@/components/ui/PasswordRules";
import { signOutAction } from "@/lib/session-actions";
import { setFirstPasswordAction } from "./actions";

export default function FirstLoginForm() {
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, formAction, isPending] = useActionState(setFirstPasswordAction, null);

  // Submit via onSubmit so React doesn't reset the fields when the server returns an error.
  const onSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  };

  // UX only; the server action re-validates with the same rules (lib/password.js).
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-2 flex justify-center">
        <StudioLogo size="lg" />
      </div>

      <div className="text-center">
        <h1 className="text-xl text-white">Set your new password</h1>
        <p className="mt-2 text-sm text-white/60">
          This is your first sign-in. Confirm the password you were given, then choose a new one.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <PasswordInput
          variant="auth"
          id="temporaryPassword"
          name="temporaryPassword"
          label="Temporary password"
          autoComplete="current-password"
          required
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.target.value)}
        />

        <div>
          <PasswordInput
            variant="auth"
            id="newPassword"
            name="newPassword"
            label="New password"
            autoComplete="new-password"
            required
            describedBy="newPassword-hint"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordRules id="newPassword-hint" password={newPassword} tone="auth" />
        </div>

        <div>
          <PasswordInput
            variant="auth"
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
          <PasswordMatch id="confirmPassword-hint" password={newPassword} confirm={confirmPassword} tone="auth" />
        </div>

        <button type="submit" disabled={isPending} className={buttonClass("primary", "mt-1 w-full")}>
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isPending ? "Saving…" : "Save and continue"}
        </button>

        <p aria-live="polite" className="min-h-5 text-center text-sm text-red-400">
          {state?.error ?? ""}
        </p>
      </form>

      <form action={signOutAction} className="flex justify-center">
        <button
          type="submit"
          className="min-h-11 rounded px-2 text-sm text-white/60 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
