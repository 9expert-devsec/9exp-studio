"use client";

import { startTransition, useActionState, useState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import StudioLogo from "@/components/brand/StudioLogo";
import { buttonClass } from "@/components/ui/Button";
import PasswordInput from "@/components/ui/PasswordInput";
import { signOutAction } from "@/lib/session-actions";
import { setFirstPasswordAction } from "./actions";

const MIN_LENGTH = 10;
const MAX_BYTES = 72;
const byteLength = (s) => new TextEncoder().encode(s).length;

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

  // UX only; the server action re-validates everything.
  const longEnough = newPassword.length >= MIN_LENGTH;
  const tooLong = byteLength(newPassword) > MAX_BYTES;
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
          <p
            id="newPassword-hint"
            aria-live="polite"
            className={`mt-1.5 flex items-center gap-1.5 text-xs ${
              tooLong ? "text-red-400" : longEnough ? "text-emerald-400" : "text-white/50"
            }`}
          >
            {longEnough && !tooLong && <CircleCheck className="size-3.5" aria-hidden="true" />}
            {tooLong ? "Too long (max 72 bytes)" : "At least 10 characters"}
          </p>
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
          <p id="confirmPassword-hint" aria-live="polite" className="mt-1.5 min-h-4 text-xs text-red-400">
            {mismatch ? "Passwords do not match." : ""}
          </p>
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
