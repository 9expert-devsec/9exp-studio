"use client";

// Shared Step 2 building blocks (Clip, Graphic, …): section card, labelled field,
// Bangkok date + time field, reference link field. Theme tokens only.

import { CalendarDays, ExternalLink, Link2 } from "lucide-react";
import TimePicker from "@/components/ui/TimePicker";
import { FieldError, input, label } from "@/components/projects/ProjectForm";
import { isHttpUrl } from "@/lib/projects/rules";

export function Section({ id, title, subtitle, children }) {
  return (
    <section aria-labelledby={id} className="rounded-[16px] border border-line bg-card p-4 sm:p-5">
      <h3 id={id} className="text-base font-bold text-fg">{title}</h3>
      <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
      <div className="my-4 h-px bg-line-subtle" />
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Label (id `${id}-label`, for={id}) + control + hint + error (`${id}-error`). */
export function Field({ id, title, required, hint, error, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} id={`${id}-label`} className={label}>
        {title} {required && <span className="text-danger" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-fg-muted">{hint}</p>}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

/** Optional http(s) link with a link icon and, once valid, an "open in new tab" button. */
export function ReferenceField({ id, value, onChange, error, title = "Reference (Optional)" }) {
  const href = value && isHttpUrl(value.trim()) ? value.trim() : null;
  return (
    <Field id={id} title={title} error={error}>
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${input} pl-9 pr-11`}
          aria-invalid={!!error || undefined}
          aria-describedby={`${id}-error`}
        />
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open reference in a new tab"
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </Field>
  );
}

/** Native date (browser calendar popover) + 24-hour time (components/ui/TimePicker.jsx, round 52), Bangkok wall clock. */
export function DateTimeField({ id, title, date, time, min, onDate, onTime, error, hint }) {
  return (
    <fieldset aria-describedby={`${id}-hint ${id}-error`} className="min-w-0">
      <legend className={label}>{title}</legend>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            id={`${id}-date`}
            type="date"
            aria-label={`${title}: date`}
            value={date}
            min={min || undefined}
            onChange={(e) => onDate(e.target.value)}
            className={`${input} pl-9`}
            aria-invalid={!!error || undefined}
          />
        </div>
        <TimePicker id={`${id}-time`} ariaLabel={`${title}: time`} value={time} onChange={onTime} disabled={!date} invalid={!!error} className="w-32" />
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-fg-muted">{hint}</p>
      <FieldError id={`${id}-error`} error={error} />
    </fieldset>
  );
}
