import { Check, CircleCheck } from "lucide-react";
import { PASSWORD_MIN_CHARS, PASSWORD_TOO_LONG, PASSWORDS_DONT_MATCH, checkPassword } from "@/lib/password";

// Inline password feedback, shared by every "set a password" form. Each block is an
// aria-live region; give its `id` to the input's aria-describedby. The reason a
// submit button is disabled is always visible here (never tooltip-only).
//
// tone: "default" (design tokens) | "auth" (fixed-dark /first-login card)
const TONES = {
  default: { muted: "text-fg-muted", danger: "text-danger", success: "text-success" },
  auth: { muted: "text-white/50", danger: "text-red-400", success: "text-emerald-400" },
};

/** Length / too-long line under a New password / Password field. */
export function PasswordRules({ id, password, tone = "default" }) {
  const c = TONES[tone] ?? TONES.default;
  const { chars, tooShort, tooLong } = checkPassword(password);

  let line;
  if (tooLong) {
    line = <span className={c.danger}>{PASSWORD_TOO_LONG}</span>;
  } else if (!tooShort) {
    line = (
      <span className={`flex items-center gap-1.5 ${c.success}`}>
        <CircleCheck className="size-3.5" aria-hidden="true" />
        {PASSWORD_MIN_CHARS}+ characters
      </span>
    );
  } else {
    // Empty field: neutral; once typing starts and it's still short: danger.
    line = (
      <span className={chars === 0 ? c.muted : c.danger}>
        {chars} / {PASSWORD_MIN_CHARS} characters
      </span>
    );
  }

  return (
    <p id={id} aria-live="polite" className="mt-1.5 min-h-4 text-xs">
      {line}
    </p>
  );
}

/** Match line under a Confirm field: nothing until typed, then mismatch or a quiet check. */
export function PasswordMatch({ id, password, confirm, tone = "default" }) {
  const c = TONES[tone] ?? TONES.default;
  const { mismatch, matches } = checkPassword(password, confirm);

  return (
    <p id={id} aria-live="polite" className="mt-1.5 min-h-4 text-xs">
      {mismatch && <span className={c.danger}>{PASSWORDS_DONT_MATCH}</span>}
      {matches && (
        <span className={`flex items-center gap-1.5 ${c.success}`}>
          <Check className="size-3.5" aria-hidden="true" />
          Passwords match
        </span>
      )}
    </p>
  );
}
