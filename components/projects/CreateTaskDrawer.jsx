"use client";

// Create / Edit Task drawer. Opened from the content detail page; open state lives
// in the URL (?newTask=1 create · ?editTask=<id> edit), so Back closes it. Closing
// (×, Cancel, Escape, a successful save) replaces the URL with `closeHref` (the
// same page + its task filters).
//
// Step 1 · Task basics (Figma node 123:6): name + type. Types come from the catalog
// (lib/tasks/types.js); a type is selectable only if enabled AND in
// `allowedTypes` (server canCreateTask per type). In edit mode the type is shown
// but locked.
// Step 2 · Task Detail (Figma: clip 126:2318, graphic 148:1062, post 152:6): only for types
// listed in drawer.detailTypes that have a client form here. "Add details" is
// disabled ("Coming soon") for every other type. Back keeps all values.
// Saving from Step 1 sends basics only; from Step 2 basics + details in ONE action
// (create: one atomic insert). The server re-validates everything.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, Info, Loader2, Lock, Pencil, Plus, X } from "lucide-react";
import { createTaskAction, updateTaskAction } from "@/app/(app)/projects/task-actions";
import { buttonClass } from "@/components/ui/Button";
import Drawer, { useDrawerClose } from "@/components/ui/Drawer";
import ClipDetailsStep, { emptyClipDetails } from "@/components/tasks/ClipDetailsStep";
import GraphicDetailsStep, { emptyGraphicDetails } from "@/components/tasks/GraphicDetailsStep";
import PostDetailsStep, { emptyPostDetails } from "@/components/tasks/PostDetailsStep";
import { TASK_TITLE_MAX } from "@/lib/projects/rules";
import { getTaskType, taskTypes } from "@/lib/tasks/types";
import { FieldError, input, label } from "./ProjectForm";

const TITLE_ID = "create-task-title";

/** Step 2 forms available on the client, keyed by type (server decides via detailTypes). */
const DETAIL_FORMS = {
  clip: { Form: ClipDetailsStep, empty: emptyClipDetails },
  graphic: { Form: GraphicDetailsStep, empty: emptyGraphicDetails },
  post: { Form: PostDetailsStep, empty: emptyPostDetails },
};

/** Fields shown on Step 1 (a Step 2 save that fails on these goes back to Step 1). */
const STEP1_FIELDS = ["title", "type"];

/**
 * @param {{ open: boolean, projectId: string, contentId: string, projectName: string,
 *           contentName: string, allowedTypes: string[], closeHref: string,
 *           returnFocusId: string, drawer: object | null }} props
 *   drawer: queries.js loadTaskDrawer() — mode, editing, detailTypes, options, people.
 */
export default function CreateTaskDrawer({ open, closeHref, returnFocusId, drawer, ...rest }) {
  const router = useRouter();
  return (
    <Drawer
      open={open && !!drawer}
      labelledBy={TITLE_ID}
      returnFocusId={returnFocusId}
      onClose={() => router.replace(closeHref, { scroll: false })}
    >
      {drawer && <TaskForm key={drawer.editing?.id ?? "new"} drawer={drawer} {...rest} />}
    </Drawer>
  );
}

function TaskForm({ projectId, contentId, projectName, contentName, allowedTypes, drawer }) {
  const requestClose = useDrawerClose();
  const editing = drawer.editing;
  const isEdit = !!editing;
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [type, setType] = useState(editing?.type ?? "");
  const [details, setDetails] = useState(() =>
    editing && DETAIL_FORMS[editing.type]
      ? { ...DETAIL_FORMS[editing.type].empty(), ...editing.details, __type: editing.type }
      : null
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();

  const detailForm = drawer.detailTypes.includes(type) ? DETAIL_FORMS[type] : null;
  // `value` may be an updater (cur → next), for fields that change asynchronously (photo uploads).
  const setField = (field, value) =>
    setDetails((d) => ({ ...d, [field]: typeof value === "function" ? value(d[field]) : value }));

  const goToDetails = () => {
    if (!detailForm) return;
    // Switching type resets Step 2 values (they belong to one type).
    if (!details || details.__type !== type) setDetails({ ...detailForm.empty(), __type: type });
    setStep(2);
  };

  const save = (withDetails) => {
    setFormError("");
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("contentId", contentId);
    fd.set("title", title);
    if (isEdit) fd.set("taskId", editing.id);
    else fd.set("type", type);
    if (withDetails && details) {
      const payload = { ...details };
      delete payload.__type;
      delete payload.hasDetails;
      delete payload.relatedHadMultiple;
      delete payload.folderId; // display only; issued by the server, never editable
      fd.set("withDetails", "1");
      fd.set("details", JSON.stringify(payload));
    }

    startTransition(async () => {
      const res = await (isEdit ? updateTaskAction(fd) : createTaskAction(fd));
      if (res?.ok) {
        requestClose();
        return;
      }
      const fieldErrors = res?.fieldErrors ?? {};
      setErrors(fieldErrors);
      setFormError(res?.error ?? "Something went wrong.");
      if (withDetails && STEP1_FIELDS.some((f) => fieldErrors[f])) setStep(1);
    });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    save(step === 2);
  };

  const heading = isEdit ? "Edit Task" : "Create Task";
  const primaryLabel = isEdit ? "Save changes" : "Create task";
  const typeInfo = getTaskType(type);
  const TypeIcon = typeInfo?.icon;

  return (
    <form onSubmit={onSubmit} noValidate className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-5 sm:px-6">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-brand-500">
          {isEdit ? <Pencil className="size-5" /> : <Plus className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={TITLE_ID} className="text-[22px] font-semibold leading-tight text-fg">{heading}</h2>
          <p className="mt-1 truncate text-sm text-fg-muted">
            {projectName} <span aria-hidden="true">›</span>
            <span className="sr-only">,</span> {contentName}
            {isEdit && <> · TASK {editing.numberLabel}</>}
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

      {/* relative: the containing block for absolutely positioned descendants
          (sr-only text, popovers) so they scroll and clip with this body instead
          of overflowing the dialog. */}
      <div className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
        {step === 1 ? (
          <StepBasics
            isEdit={isEdit}
            title={title}
            setTitle={setTitle}
            type={type}
            setType={setType}
            allowedTypes={allowedTypes}
            errors={errors}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-fg">Task detail</p>
              {typeInfo && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-fg">
                  <TypeIcon className="size-3.5" aria-hidden="true" />
                  {typeInfo.label}
                </span>
              )}
            </div>
            {detailForm && details && (
              <detailForm.Form
                values={details}
                setField={setField}
                errors={errors}
                projectId={projectId}
                isEdit={isEdit}
                options={drawer.options}
                people={drawer.people[type]}
              />
            )}
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-line bg-card px-5 py-4 sm:px-6">
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
            {step === 1 ? (
              <button
                type="button"
                onClick={goToDetails}
                disabled={!detailForm}
                title={detailForm ? undefined : type ? "Coming soon" : "Choose a type first"}
                className={buttonClass("outline")}
              >
                {isEdit ? "Edit details" : "Add details"}
              </button>
            ) : (
              <button type="button" onClick={() => setStep(1)} className={buttonClass("outline")}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
            )}
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : isEdit ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {primaryLabel}
            </button>
          </div>
        </div>
      </footer>
    </form>
  );
}

function StepBasics({ isEdit, title, setTitle, type, setType, allowedTypes, errors }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-fg">Step 1 / Task basics</p>

      {!isEdit && (
        <div className="flex gap-3 rounded-[14px] border border-info/25 bg-info/10 p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-fg">Start with the essentials</p>
            <p className="mt-1 text-fg-muted">Give your task a name and choose a type.</p>
            <p className="text-fg-muted">You can add a brief, assignee and due date later.</p>
          </div>
        </div>
      )}

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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
        <p id="task-type-help" className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
          {isEdit ? (
            <>
              <Lock className="size-3" aria-hidden="true" />
              The type can&apos;t change after the task is created.
            </>
          ) : (
            "Choose one type of work."
          )}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {taskTypes().map((t) => (
            <TypeCard
              key={t.key}
              type={t}
              checked={type === t.key}
              onSelect={() => setType(t.key)}
              disabled={isEdit ? type !== t.key : !t.enabled || !allowedTypes.includes(t.key)}
              locked={isEdit}
            />
          ))}
        </div>
        <FieldError id="task-type-error" error={errors.type} />
      </fieldset>

      {!isEdit && (
        <div className="flex gap-3 rounded-[14px] bg-card-inset p-4">
          <FileText className="mt-0.5 size-5 shrink-0 text-fg-muted" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-fg">No need to fill everything in now</p>
            <p className="mt-0.5 text-fg-muted">Create now, or add more details before creating.</p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * One selectable type: a visually hidden native radio inside the card's label, so
 * the group gets arrow keys, Space and focus for free. Selected = accent border +
 * light accent fill + filled check circle; keyboard focus shows an outline.
 */
function TypeCard({ type, checked, onSelect, disabled, locked }) {
  const Icon = type.icon;
  const muted = disabled && !checked;
  return (
    <label
      className={`group relative flex flex-col gap-2 rounded-[14px] border border-line p-3.5 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
        muted ? "cursor-not-allowed opacity-55" : locked ? "cursor-default" : "cursor-pointer hover:bg-card-inset"
      }`}
    >
      <input
        type="radio"
        name="type"
        value={type.key}
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="sr-only"
      />
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-card-inset text-fg-muted group-has-[:checked]:bg-card group-has-[:checked]:text-brand-500"
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{type.label}</span>
        {muted && !locked ? (
          <span className="shrink-0 rounded-full bg-track px-2 py-0.5 text-[10px] font-semibold text-fg-muted">
            {type.enabled ? "Not available" : "Coming soon"}
          </span>
        ) : muted ? null : (
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
