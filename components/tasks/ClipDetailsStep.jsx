"use client";

// Create / Edit Task — Step 2 "Task Detail" for Clip (Figma node 126:2318).
// Controlled by the drawer (values + setField), so Back → Step 1 → Add details
// keeps everything. Sections: Video Overview · Brief & References · Related ·
// Work & Assign · Reviewer Assign · Timeline. Candidate lists (assignee,
// reviewers) and option lists come from the server; the save re-validates all of
// it (lib/tasks/details.js).

import { CalendarDays, Clock, Link2, PlayCircle } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import PersonPicker from "@/components/tasks/PersonPicker";
import RelatedPicker from "@/components/tasks/RelatedPicker";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { FieldError, input, label } from "@/components/projects/ProjectForm";
import { WORK_LEVELS } from "@/lib/tasks/types";
import PlatformIcon from "./PlatformIcon";

const FILE_LOCATION_MAX = 1000;

/** Empty Step 2 values (also the shape posted as `details` JSON). */
export const emptyClipDetails = () => ({
  videoType: "",
  platforms: [],
  fileLocation: "",
  editingRequirements: "",
  referenceUrl: "",
  related: null, // ONE item: { kind, refId, code, name, iconUrl, isInhouse } (lib/tasks/related.js)
  workLevel: "",
  assignee: "",
  contentReviewer: "",
  videoReviewer: "",
  startDate: "",
  startTime: "",
  dueDate: "",
  dueTime: "",
});

function Section({ id, title, subtitle, children }) {
  return (
    <section aria-labelledby={id} className="rounded-[16px] border border-line bg-card p-4 sm:p-5">
      <h3 id={id} className="text-base font-bold text-fg">{title}</h3>
      <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
      <div className="my-4 h-px bg-line-subtle" />
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ id, title, required, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} id={`${id}-label`} className={label}>
        {title} {required && <span className="text-danger" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-fg-muted">{hint}</p>}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

/**
 * @param {{ values: object, setField: (field: string, value: unknown) => void,
 *           errors: Record<string, string>, projectId: string,
 *           options: { video_type: object[], platform: object[] },
 *           people: { assignee: object[], contentReviewer: object[], videoReviewer: object[] } }} props
 */
export default function ClipDetailsStep({ values, setField, errors, projectId, options, people }) {
  const videoTypes = options.video_type ?? [];
  const platforms = options.platform ?? [];
  const activeVideoTypes = videoTypes.filter((o) => o.active);
  const activePlatforms = platforms.filter((o) => o.active);
  const selectedVideoType = videoTypes.find((o) => o.id === values.videoType) ?? null;
  const selectedPlatforms = values.platforms.map((pid) => platforms.find((o) => o.id === pid)).filter(Boolean);
  const err = (f) => errors[f];

  return (
    <div className="flex flex-col gap-4">
      <Section id="sec-video" title="Video Overview" subtitle="Define the video format and key specs.">
        <Field id="clip-video-type" title="Video Type" required error={err("videoType")}>
          <Combobox
            id="clip-video-type"
            value={selectedVideoType}
            onChange={(o) => setField("videoType", o?.id ?? "")}
            options={activeVideoTypes}
            leadingIcon={PlayCircle}
            placeholder="Choose a video type"
            emptyText={videoTypes.length ? "No matches" : "No video types yet — ask an admin to add some."}
            listLabel="Video types"
            invalid={!!err("videoType")}
            describedBy="clip-video-type-error"
          />
        </Field>
        <Field id="clip-platforms" title="Platform (Target)" required error={err("platforms")}>
          <Combobox
            id="clip-platforms"
            multiple
            value={selectedPlatforms}
            onChange={(list) => setField("platforms", list.map((o) => o.id))}
            options={activePlatforms}
            renderOption={(o) => (
              <>
                <PlatformIcon icon={o.icon} />
                {o.label}
              </>
            )}
            renderChip={(o) => (
              <>
                <PlatformIcon icon={o.icon} size={16} />
                <span className="truncate">{o.label}</span>
              </>
            )}
            placeholder="Choose platforms"
            emptyText={platforms.length ? "No more platforms" : "No platforms yet — ask an admin to add some."}
            listLabel="Platforms"
            invalid={!!err("platforms")}
            describedBy="clip-platforms-error"
          />
        </Field>
        <Field id="clip-file-location" title="File Location" error={err("fileLocation")}>
          <textarea
            id="clip-file-location"
            rows={2}
            maxLength={FILE_LOCATION_MAX}
            placeholder="Path or link to the source files"
            value={values.fileLocation}
            onChange={(e) => setField("fileLocation", e.target.value)}
            className={`${input} resize-y`}
            aria-invalid={!!err("fileLocation") || undefined}
            aria-describedby="clip-file-location-error"
          />
        </Field>
      </Section>

      <Section id="sec-brief" title="Brief & References" subtitle="Tell what it should be about and how it should look.">
        <div>
          <p id="clip-requirements-label" className={label}>Editing Requirements</p>
          <RichTextEditor
            id="clip-requirements"
            value={values.editingRequirements}
            onChange={(html) => setField("editingRequirements", html)}
            labelledBy="clip-requirements-label"
            describedBy="clip-requirements-error"
            invalid={!!err("editingRequirements")}
          />
          <FieldError id="clip-requirements-error" error={err("editingRequirements")} />
        </div>
        <Field id="clip-reference" title="Reference (Optional)" error={err("referenceUrl")}>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
            <input
              id="clip-reference"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={values.referenceUrl}
              onChange={(e) => setField("referenceUrl", e.target.value)}
              className={`${input} pl-9`}
              aria-invalid={!!err("referenceUrl") || undefined}
              aria-describedby="clip-reference-error"
            />
          </div>
        </Field>
      </Section>

      <Section id="sec-related" title="Related" subtitle="Link this task to a course, program or skill.">
        <RelatedPicker
          id="clip-related"
          projectId={projectId}
          value={values.related}
          onChange={(s) => setField("related", s)}
          error={err("related")}
          legacyNote={!!values.relatedHadMultiple}
        />
      </Section>

      <Section id="sec-work" title="Work & Assign" subtitle="Set the difficulty and who does the work.">
        <Field id="clip-work-level" title="Work Level" required error={err("workLevel")}>
          <select
            id="clip-work-level"
            value={values.workLevel}
            onChange={(e) => setField("workLevel", e.target.value)}
            className={input}
            aria-invalid={!!err("workLevel") || undefined}
            aria-describedby="clip-work-level-error"
          >
            <option value="" disabled>
              Choose a work level
            </option>
            {WORK_LEVELS.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="clip-assignee" title="Assign to" error={err("assignee")}>
          <PersonPicker
            id="clip-assignee"
            people={people.assignee}
            value={values.assignee}
            onChange={(v) => setField("assignee", v)}
            error={err("assignee")}
            emptyText="No project members work on clips"
          />
        </Field>
      </Section>

      <Section id="sec-review" title="Reviewer Assign" subtitle="Who checks the content and the video.">
        <Field id="clip-content-review" title="Content Review" error={err("contentReviewer")}>
          <PersonPicker
            id="clip-content-review"
            people={people.contentReviewer}
            value={values.contentReviewer}
            onChange={(v) => setField("contentReviewer", v)}
            error={err("contentReviewer")}
            emptyText="No project members can review content"
          />
        </Field>
        <Field id="clip-video-review" title="Video Review" error={err("videoReviewer")}>
          <PersonPicker
            id="clip-video-review"
            people={people.videoReviewer}
            value={values.videoReviewer}
            onChange={(v) => setField("videoReviewer", v)}
            error={err("videoReviewer")}
            emptyText="No project members can review video"
          />
        </Field>
      </Section>

      <Section id="sec-timeline" title="Timeline" subtitle="When the work starts and is due.">
        <DateTimeField
          id="clip-start"
          title="Start Date"
          date={values.startDate}
          time={values.startTime}
          onDate={(v) => setField("startDate", v)}
          onTime={(v) => setField("startTime", v)}
          error={err("startAt")}
          hint="Time defaults to 09:00 (Bangkok)."
        />
        <DateTimeField
          id="clip-due"
          title="Due Date"
          date={values.dueDate}
          time={values.dueTime}
          min={values.startDate}
          onDate={(v) => setField("dueDate", v)}
          onTime={(v) => setField("dueTime", v)}
          error={err("dueAt")}
          hint="Time defaults to 18:00 (Bangkok)."
        />
      </Section>
    </div>
  );
}

/** Native date (browser calendar popover) + time, Bangkok wall clock. */
function DateTimeField({ id, title, date, time, min, onDate, onTime, error, hint }) {
  return (
    <fieldset aria-describedby={`${id}-hint ${id}-error`}>
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
        <div className="relative">
          <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            id={`${id}-time`}
            type="time"
            aria-label={`${title}: time`}
            value={time}
            disabled={!date}
            onChange={(e) => onTime(e.target.value)}
            className={`${input} w-32 pl-9`}
            aria-invalid={!!error || undefined}
          />
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-fg-muted">{hint}</p>
      <FieldError id={`${id}-error`} error={error} />
    </fieldset>
  );
}

