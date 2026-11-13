"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Link2, Loader2, Plus } from "lucide-react";
import { createProjectAction, updateProjectAction } from "@/app/(app)/projects/actions";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { PROJECT_ICON_LIST } from "@/lib/projects/icons";
import { DEFAULT_PROJECT_ICON, PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX } from "@/lib/projects/rules";
import MemberPicker from "./MemberPicker";
import { ProjectIconTile, StatusChip } from "./ProjectBits";

const label = "mb-1.5 block text-sm font-medium text-fg";
const input =
  "min-h-11 w-full rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-base text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-brand-500 focus:ring-1 focus:ring-brand-500 aria-[invalid=true]:border-danger sm:text-sm";

function FieldError({ id, error }) {
  return (
    <p id={id} role={error ? "alert" : undefined} className="mt-1.5 min-h-4 text-xs text-danger">
      {error ?? ""}
    </p>
  );
}

/**
 * Shared create/edit form. Server validation (lib/projects/validate.js) is
 * authoritative; its field errors render under each field. On success the action
 * redirects to /projects/[id].
 *
 * @param {{ mode: "create" | "edit", initial: object, cancelHref: string }} props
 *   initial: { id?, name, icon, type, startDate, endDate, description, briefLink,
 *              status?, owner: {id,name,avatarUrl}, members: [{id,name,email,avatarUrl}] }
 */
export default function ProjectForm({ mode, initial, cancelHref }) {
  const isEdit = mode === "edit";
  const [icon, setIcon] = useState(initial.icon || DEFAULT_PROJECT_ICON);
  const [name, setName] = useState(initial.name ?? "");
  const [type, setType] = useState(initial.type || "ongoing");
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [briefLink, setBriefLink] = useState(initial.briefLink ?? "");
  const [members, setMembers] = useState(initial.members ?? []);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();

  const chooseType = (next) => {
    setType(next);
    if (next === "ongoing") setEndDate(""); // ongoing has no end date
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    const fd = new FormData();
    if (isEdit) fd.set("id", initial.id);
    fd.set("icon", icon);
    fd.set("name", name);
    fd.set("type", type);
    fd.set("startDate", startDate);
    if (type === "campaign") fd.set("endDate", endDate);
    fd.set("description", description);
    fd.set("briefLink", briefLink);
    for (const m of members) fd.append("members", m.id);

    startTransition(async () => {
      // On success the action redirects (navigation), so a result means failure.
      const res = await (isEdit ? updateProjectAction(fd) : createProjectAction(fd));
      if (res && !res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error ?? "Something went wrong.");
      }
    });
  };

  const err = (field) => errors[field];
  const errId = (field) => `project-${field}-error`;
  const aria = (field) => ({ "aria-invalid": !!err(field) || undefined, "aria-describedby": errId(field) });

  const segment = (value, text) => (
    <label className="relative">
      <input
        type="radio"
        name="project-type"
        value={value}
        checked={type === value}
        onChange={() => chooseType(value)}
        className="peer sr-only"
      />
      <span className="inline-flex min-h-9 cursor-pointer items-center rounded-full px-4 text-sm font-semibold text-fg-muted transition-colors peer-checked:bg-brand-500 peer-checked:text-navy peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500">
        {text}
      </span>
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate className={cardClass({ padded: false, className: "mx-auto flex w-full max-w-[880px] flex-col gap-6 p-5 sm:p-7" })}>
      {/* 1. Icon */}
      <fieldset>
        <legend className={label}>Project icon</legend>
        <div className="flex flex-wrap gap-2.5">
          {PROJECT_ICON_LIST.map((opt) => (
            <label key={opt.key} title={opt.label} className="relative">
              <input
                type="radio"
                name="project-icon"
                value={opt.key}
                checked={icon === opt.key}
                onChange={() => setIcon(opt.key)}
                className="peer sr-only"
              />
              <span className="sr-only">{opt.label}</span>
              <span className="block cursor-pointer rounded-[18px] p-0.5 ring-2 ring-transparent transition peer-checked:ring-brand-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500">
                <ProjectIconTile icon={opt.key} size="md" />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 2. Name */}
      <div>
        <label htmlFor="project-name" className={label}>Project name</label>
        <input
          id="project-name"
          required
          maxLength={PROJECT_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
          autoComplete="off"
          {...aria("name")}
        />
        <FieldError id={errId("name")} error={err("name")} />
      </div>

      {/* 3. Type + dates */}
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className={label}>Project type</legend>
          <div className="inline-flex gap-1 rounded-full border border-control-line bg-control p-1">
            {segment("ongoing", "Ongoing")}
            {segment("campaign", "Campaign")}
          </div>
          <FieldError id={errId("type")} error={err("type")} />
        </fieldset>

        <div className={`grid gap-4 ${type === "campaign" ? "sm:grid-cols-2" : "sm:max-w-sm"}`}>
          <div>
            <label htmlFor="project-start" className={label}>Start date</label>
            <input id="project-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} {...aria("startDate")} />
            <FieldError id={errId("startDate")} error={err("startDate")} />
          </div>
          {type === "campaign" && (
            <div>
              <label htmlFor="project-end" className={label}>End date</label>
              <input
                id="project-end"
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={input}
                {...aria("endDate")}
              />
              <FieldError id={errId("endDate")} error={err("endDate")} />
            </div>
          )}
        </div>
      </div>

      {/* 4. Description */}
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="project-description" className={label}>
            Description <span className="font-normal text-fg-muted">(optional)</span>
          </label>
          <span className="text-xs text-fg-muted" aria-live="polite">
            {description.length}/{PROJECT_DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id="project-description"
          rows={4}
          maxLength={PROJECT_DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${input} resize-y`}
          {...aria("description")}
        />
        <FieldError id={errId("description")} error={err("description")} />
      </div>

      {/* 5. Brief link */}
      <div>
        <label htmlFor="project-brief" className={label}>
          Brief link <span className="font-normal text-fg-muted">(optional)</span>
        </label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            id="project-brief"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={briefLink}
            onChange={(e) => setBriefLink(e.target.value)}
            className={`${input} pl-9`}
            {...aria("briefLink")}
          />
        </div>
        <FieldError id={errId("briefLink")} error={err("briefLink")} />
      </div>

      {/* 6. Owner (read-only) */}
      <div>
        <p className={label}>Project owner</p>
        <div className="flex items-center gap-3 rounded-[14px] border border-line bg-card-inset px-3 py-2.5">
          <Avatar name={initial.owner.name} url={initial.owner.avatarUrl} size={36} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{initial.owner.name}</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-fg">Owner</span>
        </div>
      </div>

      {/* 7. Members */}
      <div id="members" className="scroll-mt-24">
        <label htmlFor="project-members" className={label}>
          Project members <span className="font-normal text-fg-muted">(optional)</span>
        </label>
        <MemberPicker
          id="project-members"
          ownerId={initial.owner.id}
          selected={members}
          onChange={setMembers}
          describedBy={errId("members")}
          invalid={!!err("members")}
        />
        <FieldError id={errId("members")} error={err("members")} />
      </div>

      {/* 8. Status (not an input) */}
      <div>
        <p className={label}>Status</p>
        {isEdit ? (
          <StatusChip status={initial.status} suffix="Auto" />
        ) : (
          <p className="text-sm text-fg-muted">Status is set automatically (starts as Open)</p>
        )}
      </div>

      <p role="alert" className={formError ? "text-sm text-danger" : "sr-only"}>{formError}</p>

      <div className="flex flex-col-reverse gap-2 border-t border-line-subtle pt-5 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClass("secondary")}>Cancel</Link>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : !isEdit && <Plus className="size-4" aria-hidden="true" />}
          {isEdit ? "Save changes" : "Create project"}
        </button>
      </div>
    </form>
  );
}
