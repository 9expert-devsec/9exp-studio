"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { btnPrimary, btnSecondary } from "./styles";

// Shows a temporary password ONCE. The value lives only in the parent's state and
// is dropped when the modal closes; it is never stored or logged.
// It replaces a form inside an open modal, so it takes focus (Copy) on mount.
export default function TempPasswordNotice({ password, onDone }) {
  const [copied, setCopied] = useState(false);
  const copyRef = useRef(null);
  useEffect(() => copyRef.current?.focus(), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
          <KeyRound className="size-4" aria-hidden="true" />
          Temporary password (shown once)
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="temp-password" className="sr-only">
            Temporary password
          </label>
          <input
            id="temp-password"
            readOnly
            value={password}
            onFocus={(e) => e.target.select()}
            className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-card-inset px-3 font-mono text-sm text-fg"
          />
          <button ref={copyRef} type="button" onClick={copy} className={btnSecondary}>
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copied ? "Password copied to clipboard." : ""}
        </p>
      </div>
      <p className="text-sm text-fg-muted">
        Share it securely; ask the user to change it on the Account page.
      </p>
      <button type="button" onClick={onDone} className={`${btnPrimary} sm:self-end`}>
        Done
      </button>
    </div>
  );
}
