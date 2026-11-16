"use client";

// Create Task — Step 1 · Task basics (Figma node 123:6). Opened by "+ Add task" on
// the content detail page; open state lives in the URL (?newTask=1), so Back closes
// it. Closing (×, Cancel, Escape, a successful create) replaces the URL with
// `closeHref` (the same page + its task filters, without newTask).
//
// Types come from the catalog (lib/tasks/types.js). A type is selectable only if
// it is enabled AND in `allowedTypes` (the server's canCreateTask per type); the
// rest render disabled ("Coming soon" for catalog-disabled ones such as
// Production). The server action re-validates everything.
// "Add details" (Step 2) is not built yet: disabled, "Coming soon".

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Info, Loader2, Plus, X } from "lucide-react";
import { createTaskAction } from "@/app/(app)/projects/task-actions";
import { buttonClass } from "@/components/ui/Button";
import Drawer, { useDrawerClose } from "@/components/ui/Drawer";
import { TASK_TITLE_MAX } from "@/lib/projects/rules";
import { taskTypes } from "@/lib/tasks/types";
import { FieldError, input, label } from "./ProjectForm";

const TITLE_ID = "create-task-title";

/**
 * @param {{ open: boolean, projectId: string, contentId: string, projectName: string,
 *           contentName: string, allowedTypes: string[], closeHref: string,
 *           returnFocusId: string }} props
 */
export default function CreateTaskDrawer({ open, closeHref, returnFocusId, ...rest }) {
  const router = useRouter();
  return (
    <Drawer
      open={open}
      labelledBy={TITLE_ID}
      returnFocusId={returnFocusId}
      onClose={() => router.replace(closeHref, { scroll: false })}
    >
      <CreateTaskForm {...rest} />
    </Drawer>
  );
}

function CreateTaskForm({ projectId, contentId, projectName, contentName, allowedTypes }) {
  const requestClose = useDrawerClose();
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    const form = new FormData(e.currentTarget);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("contentId", contentId);
    fd.set("title", String(form.get("title") ?? ""));
    fd.set("type", String(form.get("type") ?? ""));

    startTransition(async () => {
      const res = await createTaskAction(fd);
      if (res?.ok) {
        requestClose();
        return;
      }
      setErrors(res?.fieldErrors ?? {});
      setFormError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3 border-b border-line px-5 py-5 sm:px-6">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-brand-500">
          <Plus className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={TITLE_ID} className="text-[22px] font-semibold leading-tight text-fg">Create Task</h2>
          <p className="mt-1 truncate text-sm text-fg-muted">
            {projectName} <span aria-hidden="true">›</span>
            <span className="sr-only">,</span> {contentName}
          </p>
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line text-fg-muted transition-colors hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-6 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-fg">Step 1 / Task basics</p>

        <div className="flex gap-3 rounded-[14px] border border-info/25 bg-info/10 p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-fg">Start with the essentials</p>
            <p className="mt-1 text-fg-muted">Give your task a name and choose a type.</p>
            <p className="text-fg-muted">You can add a brief, assignee and due date later.</p>
          </div>
        </div>

        <div>
          <label htmlFor="task-title" className={label}>
            Task name <span className="text-danger" aria-hidden="true">*</span>
          </label>
          <input
            id="task-title"
            name="title"
            required
            maxLength={TASK_TITLE_MAX}
            placeholder="e.g. Edit HR onboarding video"
            autoComplete="off"
            className={input}
            aria-invalid={!!errors.title || undefined}
            aria-describedby="task-title-help task-title-error"
          />
          <p id="task-title-help" className="mt-1.5 text-xs text-fg-muted">
            Use a clear name that tells your team what needs to be done.
          </p>
          <FieldError id="task-title-error" error={errors.title} />
        </div>

        <fieldset aria-describedby="task-type-help task-type-error">
          <legend className="text-sm font-medium text-fg">
            Task type <span className="text-danger" aria-hidden="true">*</span>
          </legend>
          <p id="task-type-help" className="mt-0.5 text-xs text-fg-muted">Choose one type of work.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {taskTypes().map((t) => (
              <TypeCard key={t.key} type={t} disabled={!t.enabled || !allowedTypes.includes(t.key)} />
            ))}
          </div>
          <FieldError id="task-type-error" error={errors.type} />
        </fieldset>

        <div className="flex gap-3 rounded-[14px] bg-card-inset p-4">
          <FileText className="mt-0.5 size-5 shrink-0 text-fg-muted" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-fg">No need to fill everything in now</p>
            <p className="mt-0.5 text-fg-muted">Create now, or add more details before creating.</p>
          </div>
        </div>
      </div>

      <footer className="border-t border-line bg-card px-5 py-4 sm:px-6">
        {formError && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={requestClose} className={buttonClass("outline")}>
            Cancel
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" disabled title="Coming soon" className={buttonClass("outline")}>
              Add details
            </button>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Create task
            </button>
          </div>
        </div>
      </footer>
    </form>
  );
}

/**
 * One selectable type: a visually hidden native radio inside the card's label, so
 * the group gets arrow keys, Space and form value for free. Selected = accent border
 * + light accent fill + filled check circle; keyboard focus shows an outline.
 */
function TypeCard({ type, disabled }) {
  const Icon = type.icon;
  return (
    <label
      className={`group relative flex flex-col gap-2 rounded-[14px] border border-line p-3.5 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-card-inset"
      }`}
    >
      <input type="radio" name="type" value={type.key} disabled={disabled} className="sr-only" />
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-card-inset text-fg-muted group-has-[:checked]:bg-card group-has-[:checked]:text-brand-500"
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{type.label}</span>
        {disabled ? (
          <span className="shrink-0 rounded-full bg-track px-2 py-0.5 text-[10px] font-semibold text-fg-muted">
            {type.enabled ? "Not available" : "Coming soon"}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-line text-navy group-has-[:checked]:border-brand-500 group-has-[:checked]:bg-brand-500"
          >
            <Check className="hidden size-3 group-has-[:checked]:block" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="text-xs text-fg-muted">{type.description}</span>
    </label>
  );
}
