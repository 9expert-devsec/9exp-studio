"use client";

// Shared "Related" control (Figma 148:1062, Related card), reused by every task
// type's Step 2: ONE optional item — a course OR a program OR a skill.
//   Related Type  Course · Program · Skill (segmented; switching clears the pick)
//   Select        one searchable list of that type from the MSDB mirror
//                 (Course = public + online together, badged Public / Online /
//                 In-house); the pick shows as the select's value with a ×.
// `legacyNote`: the task came from the old multi-field shape with > 1 item.
//
// value: { kind, refId, code, name, iconUrl, isInhouse } | null (lib/tasks/related.js)

import { useState } from "react";
import { Info } from "lucide-react";
import { searchRelatedAction } from "@/app/(app)/projects/task-actions";
import Combobox from "@/components/ui/Combobox";
import MsdbIcon from "@/components/tasks/MsdbIcon";
import { FieldError, label } from "@/components/projects/ProjectForm";
import { RELATED_TYPES, relatedBadge, relatedTypeOf } from "@/lib/tasks/related";

export function RelatedBadge({ kind, isInhouse }) {
  const text = relatedBadge(kind, isInhouse);
  if (!text) return null;
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        isInhouse ? "bg-accent-soft text-accent-fg" : "bg-track text-fg-muted"
      }`}
    >
      {text}
    </span>
  );
}

function RelatedItem({ s }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <MsdbIcon url={s.iconUrl} code={s.code} name={s.name} />
      <span className="min-w-0 truncate">{s.name}</span>
      <RelatedBadge kind={s.kind} isInhouse={s.isInhouse} />
    </span>
  );
}

export default function RelatedPicker({ id, projectId, value, onChange, error, legacyNote = false }) {
  const [pickedType, setPickedType] = useState(() => relatedTypeOf(value?.kind) ?? "course");
  // A chosen item decides the type; otherwise the segment the user picked.
  const type = relatedTypeOf(value?.kind) ?? pickedType;
  const noun = RELATED_TYPES.find((t) => t.key === type)?.label ?? "Item";

  const chooseType = (key) => {
    if (key === type) return;
    setPickedType(key);
    if (value) onChange(null); // switching the type clears the selection
  };

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className={label}>Related Type</legend>
        <div className="grid grid-cols-3 gap-1 rounded-[12px] border border-line p-1">
          {RELATED_TYPES.map((t) => (
            <label
              key={t.key}
              className="flex min-h-10 cursor-pointer items-center justify-center rounded-[10px] border border-transparent px-2 text-sm text-fg-muted transition-colors hover:text-fg has-[:checked]:border-brand-500 has-[:checked]:bg-accent-soft has-[:checked]:font-semibold has-[:checked]:text-accent-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-brand-500"
            >
              <input
                type="radio"
                name={`${id}-type`}
                value={t.key}
                checked={type === t.key}
                onChange={() => chooseType(t.key)}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={id} id={`${id}-label`} className={label}>
          Select
        </label>
        {legacyNote && (
          <p id={`${id}-note`} className="mb-2 flex items-start gap-1.5 text-xs text-warning">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Only one related item is kept — the others will be removed when you save.
          </p>
        )}
        <Combobox
          id={id}
          value={value}
          onChange={onChange}
          search={(q) => searchRelatedAction(projectId, type, q)}
          searchKey={type}
          getKey={(s) => `${s.kind}:${s.refId}`}
          getLabel={(s) => s.name}
          renderOption={(s) => <RelatedItem s={s} />}
          renderValue={(s) => <RelatedItem s={s} />}
          labelledBy={`${id}-label`}
          placeholder={`Search ${noun.toLowerCase()}s`}
          emptyText={`No matching ${noun.toLowerCase()}s`}
          listLabel={`${noun}s`}
          invalid={!!error}
          describedBy={[legacyNote ? `${id}-note` : "", `${id}-error`].filter(Boolean).join(" ")}
        />
        <FieldError id={`${id}-error`} error={error} />
      </div>
    </div>
  );
}
