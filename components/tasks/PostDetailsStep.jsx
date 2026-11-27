"use client";

// Create / Edit Task — Step 2 "Task Detail" for Post (Figma 152:6).
// Controlled by the drawer (values + setField). Cards: Platform & Work Type ·
// Wording Post · Related · Assign Post · Related Assets · Schedule Post. The save
// re-validates everything (lib/tasks/details.js parsePostDetails).
//   - Post Type = the Work Type list filtered by platform (shared control).
//   - Related Assets: the shared card + picker (RelatedAssetsCard), with the
//     derived Status Asset (lib/tasks/assets.js), read-only.
//   - Schedule Post = the task's due date (Bangkok; date only → 18:00).

import { CalendarDays } from "lucide-react";
import TimePicker from "@/components/ui/TimePicker";
import { Field, Section } from "@/components/tasks/DetailBlocks";
import PersonPicker from "@/components/tasks/PersonPicker";
import PlatformWorkTypeFields from "@/components/tasks/PlatformWorkTypeFields";
import RelatedAssetsCard from "@/components/tasks/RelatedAssetsCard";
import RelatedPicker from "@/components/tasks/RelatedPicker";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { FieldError, input, label } from "@/components/projects/ProjectForm";

/** Empty Step 2 values (also the shape posted as `details` JSON). */
export const emptyPostDetails = () => ({
  platform: "",
  workType: "",
  brief: "",
  related: null,
  assignee: "",
  relatedAssets: [], // live rows (RelatedAssetsCard); the server stores ids
  dueDate: "",
  dueTime: "",
});

/**
 * @param {{ values: object, setField: (field: string, value: unknown) => void,
 *           errors: Record<string, string>, projectId: string,
 *           options: { platform: object[], work_type: object[] },
 *           people: { assignee: object[] } }} props
 */
export default function PostDetailsStep({ values, setField, errors, projectId, options, people }) {
  const err = (f) => errors[f];

  return (
    <div className="flex flex-col gap-4">
      <Section id="sec-post-platform" title="Platform & Work Type" subtitle="Select the platform and type of post.">
        <div className="grid gap-4 sm:grid-cols-2">
          <PlatformWorkTypeFields idPrefix="post" workTypeTitle="Post Type" values={values} setField={setField} errors={errors} options={options} />
        </div>
      </Section>

      <Section id="sec-post-wording" title="Wording Post" subtitle="Tell what it should be about and how it should look.">
        <div>
          <p id="post-brief-label" className={label}>Brief</p>
          <RichTextEditor
            id="post-brief"
            value={values.brief}
            onChange={(html) => setField("brief", html)}
            labelledBy="post-brief-label"
            describedBy="post-brief-error"
            invalid={!!err("brief")}
          />
          <FieldError id="post-brief-error" error={err("brief")} />
        </div>
      </Section>

      <Section id="sec-post-related" title="Related" subtitle="Link this task to a course, program or skill.">
        <RelatedPicker
          id="post-related"
          projectId={projectId}
          value={values.related}
          onChange={(s) => setField("related", s)}
          error={err("related")}
          legacyNote={!!values.relatedHadMultiple}
        />
      </Section>

      <Section id="sec-post-assign" title="Assign Post" subtitle="Who prepares and publishes the post.">
        <Field id="post-assignee" title="Assign to" error={err("assignee")}>
          <PersonPicker
            id="post-assignee"
            people={people.assignee}
            value={values.assignee}
            onChange={(v) => setField("assignee", v)}
            error={err("assignee")}
            emptyText="No project members work on posts"
          />
        </Field>
      </Section>

      <RelatedAssetsCard
        idPrefix="post"
        subtitle="The clips, graphics, photos or articles this post uses."
        assets={values.relatedAssets ?? []}
        setAssets={(next) => setField("relatedAssets", next)}
        error={err("relatedAssets")}
        showAssetStatus
      />

      <Section id="sec-post-schedule" title="Schedule Post" subtitle="When the post is published (the task's due date).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="post-due-date" title="Date" error={err("dueAt")}>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              <input
                id="post-due-date"
                type="date"
                value={values.dueDate}
                onChange={(e) => setField("dueDate", e.target.value)}
                className={`${input} pl-9`}
                aria-invalid={!!err("dueAt") || undefined}
                aria-describedby="post-due-hint post-due-date-error"
              />
            </div>
          </Field>
          <Field id="post-due-time" title="Time">
            {/* Round 52: 24-hour picker (the native time input showed AM/PM). */}
            <TimePicker
              id="post-due-time"
              value={values.dueTime}
              onChange={(v) => setField("dueTime", v)}
              disabled={!values.dueDate}
              describedBy="post-due-hint"
            />
          </Field>
        </div>
        <p id="post-due-hint" className="-mt-2 text-xs text-fg-muted">Time defaults to 18:00 (Bangkok).</p>
      </Section>
    </div>
  );
}
