"use client";

// Folder ID "next number" (superadmin; the action re-checks). People still make
// some folders by hand, so the admin can move the counter forward for the
// current Bangkok month. The server rejects a number the system already issued.

import { useState, useTransition } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { btnSecondary, card, errorText, input } from "@/components/team/styles";
import { formatFolderId } from "@/lib/tasks/folderId";
import { setNextFolderNumberAction } from "./actions";

function FolderIdRow({ row }) {
  const [next, setNext] = useState(String(row.nextNumber));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, startTransition] = useTransition();

  const n = /^\d{1,6}$/.test(next.trim()) ? Number(next.trim()) : null;
  const tooLow = n !== null && n <= row.highestIssued;
  const preview = n !== null && n >= 1 ? formatFolderId(row.yymm, n, row.suffix) : null;
  const unchanged = n === row.nextNumber;

  const save = (e) => {
    e.preventDefault();
    setError("");
    setSaved("");
    const fd = new FormData();
    fd.set("suffix", row.suffix);
    fd.set("next", next.trim());
    startTransition(async () => {
      const res = await setNextFolderNumberAction(fd);
      if (res?.ok) setSaved(`Saved. Next ID: ${res.nextId}`);
      else setError(res?.error ?? "Something went wrong.");
    });
  };

  const inputId = `folder-next-${row.suffix}`;
  return (
    <form onSubmit={save} noValidate className="flex flex-col flex-wrap gap-3 border-t border-line-subtle px-5 py-4 first:border-t-0 sm:flex-row sm:items-end sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">
          {row.label} <span className="font-mono text-fg-muted">({row.suffix})</span>
        </p>
        <p className="mt-0.5 text-xs text-fg-muted">
          Last used: {row.lastId ? <span className="font-mono">{row.lastId}</span> : "none yet this month"}
          {row.highestIssued > 0 && (
            <> · Highest issued by the system: <span className="font-mono">{formatFolderId(row.yymm, row.highestIssued, row.suffix)}</span></>
          )}
        </p>
      </div>
      <div className="w-full sm:w-36">
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-fg">Next number</label>
        <input
          id={inputId}
          inputMode="numeric"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={input}
          aria-invalid={tooLow || n === null || undefined}
          aria-describedby={`${inputId}-preview ${inputId}-error`}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1 sm:items-end">
        <p id={`${inputId}-preview`} className="text-sm text-fg" aria-live="polite">
          Next ID: <span className="font-mono font-semibold">{preview ?? "—"}</span>
        </p>
        <button type="submit" disabled={pending || n === null || n < 1 || tooLow || unchanged} className={btnSecondary}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
      </div>
      <p id={`${inputId}-error`} role="alert" className={error || tooLow ? `${errorText} sm:basis-full` : "sr-only"}>
        {error || (tooLow ? `Must be ${row.highestIssued + 1} or higher — the system already issued up to ${row.highestIssued}.` : "")}
      </p>
      {saved && (
        <p role="status" className="text-sm text-success sm:basis-full">
          {saved}
        </p>
      )}
    </form>
  );
}

export default function FolderIdPanel({ rows }) {
  if (!rows?.length) return null;
  return (
    <section aria-labelledby="folder-id-heading" className={card}>
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-brand-500">
          <FolderOpen className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="folder-id-heading" className="text-base font-semibold text-fg">Folder ID</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            Issued automatically when a task is created with &ldquo;New Folder&rdquo; (format YYMM-NNN + type: G Graphic, P Photo).
            This month ({rows[0].yymm}): set the next number if folders were made by hand.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col">
        {rows.map((row) => (
          <FolderIdRow key={`${row.yymm}-${row.suffix}-${row.nextNumber}`} row={row} />
        ))}
      </div>
    </section>
  );
}
