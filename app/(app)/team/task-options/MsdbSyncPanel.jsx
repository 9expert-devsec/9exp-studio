"use client";

// MSDB mirror status + "Sync now" (superadmin; the action re-checks). The
// Related pickers in task details search this mirror; a daily cron keeps it fresh.

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { btnSecondary, card, errorText } from "@/components/team/styles";
import { syncMsdbNowAction } from "./actions";

export default function MsdbSyncPanel({ status }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const syncNow = () => {
    setError("");
    startTransition(async () => {
      const res = await syncMsdbNowAction();
      if (!res?.ok) setError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <section aria-labelledby="msdb-sync-heading" className={`${card} flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between`}>
      <div className="min-w-0">
        <h2 id="msdb-sync-heading" className="text-base font-semibold text-fg">MSDB master data</h2>
        <p className="mt-0.5 text-sm text-fg-muted">
          Courses, programs and skills for the Related pickers. Synced daily from MSDB.
        </p>
        <p className="mt-2 text-sm text-fg" aria-live="polite">
          {pending ? (
            "Syncing…"
          ) : status.lastSynced ? (
            <>
              Last synced <span title={status.lastSyncedTitle}>{status.lastSynced}</span>
              {status.counts && <> · {status.counts}</>}
            </>
          ) : (
            "Not synced yet."
          )}
        </p>
        {!pending && status.lastError && (
          <p className="mt-1 text-xs text-warning">Last error: {status.lastError}</p>
        )}
        <p role="alert" className={error ? `mt-1 ${errorText}` : "sr-only"}>{error}</p>
      </div>
      <button type="button" onClick={syncNow} disabled={pending} className={`${btnSecondary} shrink-0`}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
        {pending ? "Syncing…" : "Sync now"}
      </button>
    </section>
  );
}
