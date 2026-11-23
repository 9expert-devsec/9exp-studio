"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { changeTaskStatusAction } from "@/app/(app)/projects/task-actions";
import { invalidateTaskPanel } from "@/components/tasks/panelCache";
import { StatusDot } from "@/components/projects/ProjectBits";
import { buttonClass } from "@/components/ui/Button";

// "Change status" (round 40) — ONE component for the task ⋯ menu and Task Detail.
// Shows only the moves the server computed (task.statusMoves, from
// lib/tasks/transitions.js allowedNextStatuses), grouped: forward arrows, then
// back / pause / resume / reopen, then Cancel (destructive, confirmed once), then
// — for superadmin / project owner — "Set status…" with the rest. The action
// re-checks every move (canTransition).

const HINT = { back: "Back one step", pause: "Pause", resume: "Resume", reopen: "Reopen" };

const optionRow =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border border-line px-3.5 text-sm text-fg transition-colors hover:bg-card-inset has-[:checked]:border-brand-500 has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500";
const dangerRow =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border border-line px-3.5 text-sm text-danger transition-colors hover:bg-danger/5 has-[:checked]:border-danger has-[:checked]:bg-danger/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-danger";

function MoveGroup({ legend, moves, value, onChange, danger = false, first = false }) {
  if (!moves.length) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">{legend}</legend>
      {moves.map((m, i) => (
        <label key={m.key} className={danger ? dangerRow : optionRow}>
          <input
            type="radio"
            name="status"
            value={m.key}
            checked={value === m.key}
            onChange={() => onChange(m.key)}
            data-autofocus={first && i === 0 ? true : undefined}
            className={danger ? "size-4 accent-danger" : "size-4 accent-brand-500"}
          />
          <span className="flex-1">{m.label}</span>
          {HINT[m.kind] && <span className="text-xs text-fg-muted">{HINT[m.kind]}</span>}
          <StatusDot status={m.group} />
        </label>
      ))}
    </fieldset>
  );
}

/**
 * @param {{ task: { id, projectId, contentId, statusLabel, statusMoves, assetStatusLabel? },
 *           onDone: () => void, onSaved?: () => void }} props
 */
export default function StatusMoveForm({ task, onDone, onSaved }) {
  const moves = task.statusMoves ?? [];
  const forward = moves.filter((m) => m.kind === "forward");
  const other = moves.filter((m) => ["back", "pause", "resume", "reopen"].includes(m.kind));
  const cancel = moves.filter((m) => m.kind === "cancel");
  const override = moves.filter((m) => m.kind === "override");
  const groups = [forward, other, cancel, override].filter((g) => g.length);

  const [status, setStatus] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const chosen = moves.find((m) => m.key === status) ?? null;

  const save = () => {
    setError("");
    const fd = new FormData();
    fd.set("projectId", task.projectId);
    fd.set("contentId", task.contentId);
    fd.set("taskId", task.id);
    fd.set("status", status);
    startTransition(async () => {
      const res = await changeTaskStatusAction(fd);
      if (res?.ok) {
        invalidateTaskPanel(); // Task Detail cache (an open panel refetches)
        onSaved?.();
        onDone();
      } else {
        setConfirming(false);
        setError(res?.error ?? "Something went wrong.");
      }
    });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!chosen) return setError("Choose a status.");
    if (chosen.kind === "cancel" && !confirming) return setConfirming(true);
    save();
  };

  const actions = (primaryLabel, danger) => (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={confirming ? () => setConfirming(false) : onDone} className={buttonClass("secondary")} data-autofocus={confirming || undefined}>
        {confirming ? "Keep task" : "Close"}
      </button>
      <button type="submit" disabled={pending || !chosen} className={buttonClass(danger ? "danger" : "primary")}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {primaryLabel}
      </button>
    </div>
  );

  if (confirming) {
    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-fg">
          Cancel this task? It&apos;s left out of progress. You can reopen it later and it returns to{" "}
          <span className="font-semibold">{task.statusLabel}</span>.
        </p>
        <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
        {actions("Cancel task", true)}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="text-sm text-fg-muted">
        Current: <span className="font-semibold text-fg">{task.statusLabel}</span>
      </p>
      {groups.length === 0 ? (
        <p className="text-sm text-fg-muted">No status changes are available for this task.</p>
      ) : (
        <>
          <MoveGroup legend="Next" moves={forward} value={status} onChange={setStatus} first={groups[0] === forward} />
          <MoveGroup legend="Other moves" moves={other} value={status} onChange={setStatus} first={groups[0] === other} />
          <MoveGroup legend="Cancel" moves={cancel} value={status} onChange={setStatus} danger first={groups[0] === cancel} />
          {override.length > 0 && (
            <div className="border-t border-line pt-4">
              <MoveGroup legend="Set status…" moves={override} value={status} onChange={setStatus} first={groups[0] === override} />
            </div>
          )}
        </>
      )}
      {task.assetStatusLabel && (
        <p className="text-xs text-fg-muted">
          Asset: <span className="font-medium text-fg">{task.assetStatusLabel}</span> — set automatically from the post&apos;s Related Assets.
        </p>
      )}
      <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
      {actions(chosen?.kind === "cancel" ? "Cancel task…" : "Save", false)}
    </form>
  );
}
