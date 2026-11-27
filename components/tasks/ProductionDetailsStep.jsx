"use client";

// Create / Edit Task — Step 2 "Task Detail" for Production (Figma 208:185, round
// 38). Controlled by the drawer (values + setField). Cards: Brief & References ·
// Related · Roles & Assignments · Schedule a Shoot. Nothing is required. The save
// re-validates everything (lib/tasks/details.js parseProductionDetails).
//   - Videographer: one or more accounts whose role may do Production; the FIRST
//     one becomes the task's assignee.
//   - Presenter: accounts (any active one) or external people typed by name —
//     saved for reuse when the task is saved (MultiPersonPicker allowExternal).
//   - Start / Due Date = the task's start / due (09:00 / 18:00 Bangkok).

import { DateTimeField, Field, ReferenceField, Section } from "@/components/tasks/DetailBlocks";
import MultiPersonPicker from "@/components/tasks/MultiPersonPicker";
import RelatedPicker from "@/components/tasks/RelatedPicker";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { FieldError, label } from "@/components/projects/ProjectForm";
import { PRODUCTION_PEOPLE_MAX } from "@/lib/tasks/production";
import ShootFields from "@/components/tasks/ShootFields";

/** Empty Step 2 values (also the shape posted as `details` JSON). */
export const emptyProductionDetails = () => ({
  brief: "",
  scriptUrl: "",
  recordUrl: "",
  related: null,
  videographers: [], // [{ kind: "user", id }]
  presenters: [], // [{ kind: "user" | "external", id } | { kind: "external", name }]
  startDate: "",
  startTime: "",
  dueDate: "",
  dueTime: "",
  // Optional "นัดถ่าย" (round 48): all three or none.
  shootDate: "",
  shootTime: "",
  shootLocation: "",
});

/**
 * Posted as-is: videographers and presenters as picker entries (the server
 * reads both shapes — lib/tasks/production.js readProductionPeople).
 * @param {{ values: object, setField: (field: string, value: unknown) => void,
 *           errors: Record<string, string>, projectId: string, externals?: object[],
 *           people: { videographer: object[], presenter: object[] } }} props
 */
export default function ProductionDetailsStep({ values, setField, errors, projectId, people, externals = [] }) {
  const err = (f) => errors[f];
  return (
    <div className="flex flex-col gap-4">
      <Section id="sec-production-brief" title="Brief & References" subtitle="Tell what it should be about and how it should look.">
        <div>
          <p id="production-brief-label" className={label}>Brief</p>
          <RichTextEditor
            id="production-brief"
            value={values.brief}
            onChange={(html) => setField("brief", html)}
            labelledBy="production-brief-label"
            describedBy="production-brief-error"
            invalid={!!err("brief")}
          />
          <FieldError id="production-brief-error" error={err("brief")} />
        </div>
        <ReferenceField
          id="production-script"
          title="Script Reference"
          value={values.scriptUrl}
          onChange={(v) => setField("scriptUrl", v)}
          error={err("scriptUrl")}
        />
        <ReferenceField
          id="production-record"
          title="File Record"
          value={values.recordUrl}
          onChange={(v) => setField("recordUrl", v)}
          error={err("recordUrl")}
        />
      </Section>

      <Section id="sec-production-related" title="Related" subtitle="Link this task to a course, program or skill.">
        <RelatedPicker
          id="production-related"
          projectId={projectId}
          value={values.related}
          onChange={(s) => setField("related", s)}
          error={err("related")}
          legacyNote={!!values.relatedHadMultiple}
        />
      </Section>

      <Section id="sec-production-roles" title="Roles & Assignments" subtitle="Who films and who presents. The first videographer is the task's assignee.">
        <Field id="production-videographers" title="Videographer" error={err("videographers")}>
          <MultiPersonPicker
            id="production-videographers"
            people={people.videographer ?? []}
            value={values.videographers ?? []}
            onChange={(next) => setField("videographers", next)}
            max={PRODUCTION_PEOPLE_MAX}
            error={err("videographers")}
            emptyText="No project members work on production"
          />
        </Field>
        <Field id="production-presenters" title="Presenter" error={err("presenters")}>
          <MultiPersonPicker
            id="production-presenters"
            people={people.presenter ?? []}
            externals={externals}
            allowExternal
            value={values.presenters ?? []}
            onChange={(next) => setField("presenters", next)}
            max={PRODUCTION_PEOPLE_MAX}
            error={err("presenters")}
          />
        </Field>
      </Section>

      {/* Stacked like Graphic: date + time side by side need the full drawer width. */}
      <Section id="sec-production-schedule" title="Schedule a Shoot" subtitle="When the shoot starts and when it is due.">
        <div className="flex flex-col gap-4">
          <DateTimeField
            id="production-start"
            title="Start Date"
            date={values.startDate}
            time={values.startTime}
            onDate={(v) => setField("startDate", v)}
            onTime={(v) => setField("startTime", v)}
            error={err("startAt")}
            hint="Time defaults to 09:00 (Bangkok)."
          />
          <DateTimeField
            id="production-due"
            title="Due Date"
            date={values.dueDate}
            time={values.dueTime}
            min={values.startDate}
            onDate={(v) => setField("dueDate", v)}
            onTime={(v) => setField("dueTime", v)}
            error={err("dueAt")}
            hint="Time defaults to 18:00 (Bangkok)."
          />
        </div>
      </Section>
      <Section id="sec-production-shoot" title="นัดถ่าย" subtitle="ไม่บังคับ · วัน เวลา และสถานที่ถ่าย (ตั้งหรือเลื่อนได้ภายหลังจาก Task Detail)">
        <ShootFields id="production-shoot" values={values} setField={setField} errors={errors} />
      </Section>
    </div>
  );
}
