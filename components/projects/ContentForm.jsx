"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { createContentAction, updateContentAction } from "@/app/(app)/projects/content-actions";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { CONTENT_DESCRIPTION_MAX, CONTENT_NAME_MAX } from "@/lib/projects/rules";
import { FieldError, input, label } from "./ProjectForm";

/**
 * Shared Create/Edit Content form. Server validation (parseContentForm) is
 * authoritative; its field errors render under each field. On success the action
 * redirects to the project's Content tab. No status field (status is automatic).
 *
 * @param {{ mode: "create" | "edit", projectId: string, cancelHref: string,
 *           initial: { id?: string, name: string, description: string, briefLink: string } }} props
 */
export default function ContentForm({ mode, projectId, initial, cancelHref }) {
  const isEdit = mode === "edit";
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [briefLink, setBriefLink] = useState(initial.briefLink ?? "");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    const fd = new FormData();
    fd.set("projectId", projectId);
    if (isEdit) fd.set("contentId", initial.id);
    fd.set("name", name);
    fd.set("description", description);
    fd.set("briefLink", briefLink);

    startTransition(async () => {
      // On success the action redirects (navigation), so a result means failure.
      const res = await (isEdit ? updateContentAction(fd) : createContentAction(fd));
      if (res && !res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error ?? "Something went wrong.");
      }
    });
  };

  const err = (field) => errors[field];
  const errId = (field) => `content-${field}-error`;
  const aria = (field, extra) => ({
    "aria-invalid": !!err(field) || undefined,
    "aria-describedby": [errId(field), extra].filter(Boolean).join(" "),
  });

  return (
    <form onSubmit={onSubmit} noValidate className={cardClass({ padded: false, className: "flex flex-col gap-6 p-5 sm:p-7" })}>
      <div>
        <label htmlFor="content-name" className={label}>Content Name</label>
        <input
          id="content-name"
          required
          maxLength={CONTENT_NAME_MAX}
          placeholder="Enter content name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
          autoComplete="off"
          {...aria("name")}
        />
        <FieldError id={errId("name")} error={err("name")} />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="content-description" className={label}>
            Description <span className="font-normal text-fg-muted">(optional)</span>
          </label>
          <span className="text-xs text-fg-muted" aria-live="polite">
            {description.length}/{CONTENT_DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id="content-description"
          rows={6}
          maxLength={CONTENT_DESCRIPTION_MAX}
          placeholder="Describe the content, key message, and expected outcome…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${input} resize-y`}
          {...aria("description")}
        />
        <FieldError id={errId("description")} error={err("description")} />
      </div>

      <div>
        <label htmlFor="content-brief" className={label}>
          Brief Link <span className="font-normal text-fg-muted">(optional)</span>
        </label>
        <input
          id="content-brief"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={briefLink}
          onChange={(e) => setBriefLink(e.target.value)}
          className={input}
          {...aria("briefLink", "content-brief-help")}
        />
        <p id="content-brief-help" className="mt-1.5 text-xs text-fg-muted">
          Add a link to the brief or reference document.
        </p>
        <FieldError id={errId("briefLink")} error={err("briefLink")} />
      </div>

      <p role="alert" className={formError ? "text-sm text-danger" : "sr-only"}>{formError}</p>

      <div className="flex flex-col-reverse gap-2 border-t border-line-subtle pt-5 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClass("secondary")}>Cancel</Link>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : !isEdit && <Plus className="size-4" aria-hidden="true" />}
          {isEdit ? "Save changes" : "Create Content"}
        </button>
      </div>
    </form>
  );
}
