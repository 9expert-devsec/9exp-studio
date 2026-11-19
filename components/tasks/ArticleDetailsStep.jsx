"use client";

// Create / Edit Task — Step 2 "Task Detail" for Article (Figma 169:698, plus the
// two ruled additions: Article Type and Timeline). Controlled by the drawer
// (values + setField). Cards: Article Type · Related · Writer · Related Assets ·
// Timeline. The save re-validates everything (lib/tasks/details.js
// parseArticleDetails).
//   - Article Type: ONE option from the Article Type list (Task Options); a saved
//     option that later went inactive still shows and stays valid.
//   - Writer = the task's assignee (roles allowed to do Article).
//   - Related Assets: the shared card + picker (no Status Asset — Post only).

import { FileText } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { DateTimeField, Field, Section } from "@/components/tasks/DetailBlocks";
import PersonPicker from "@/components/tasks/PersonPicker";
import RelatedAssetsCard from "@/components/tasks/RelatedAssetsCard";
import RelatedPicker from "@/components/tasks/RelatedPicker";

/** Empty Step 2 values (also the shape posted as `details` JSON). */
export const emptyArticleDetails = () => ({
  articleType: "",
  related: null,
  assignee: "", // Writer
  relatedAssets: [], // live rows (RelatedAssetsCard); the server stores ids
  startDate: "",
  startTime: "",
  dueDate: "",
  dueTime: "",
});

/**
 * @param {{ values: object, setField: (field: string, value: unknown) => void,
 *           errors: Record<string, string>, projectId: string,
 *           options: { article_type: object[] },
 *           people: { assignee: object[] } }} props
 */
export default function ArticleDetailsStep({ values, setField, errors, projectId, options, people }) {
  const err = (f) => errors[f];
  const articleTypes = options.article_type ?? [];
  const choices = articleTypes.filter((o) => o.active || o.id === values.articleType);
  const selected = choices.find((o) => o.id === values.articleType) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Section id="sec-article-type" title="Article Type" subtitle="What kind of article this is.">
        <Field
          id="article-type"
          title="Article Type"
          required
          error={err("articleType")}
          hint={choices.length === 0 ? "No article types yet — add them in Team Management → Task Options." : undefined}
        >
          <Combobox
            id="article-type"
            value={selected}
            onChange={(o) => setField("articleType", o?.id ?? "")}
            options={choices}
            renderValue={(o) => <span className="truncate">{o.label}</span>}
            labelledBy="article-type-label"
            leadingIcon={FileText}
            placeholder="Choose an article type"
            emptyText={articleTypes.length ? "No matches" : "No article types yet"}
            listLabel="Article types"
            invalid={!!err("articleType")}
            describedBy="article-type-error"
          />
        </Field>
      </Section>

      <Section id="sec-article-related" title="Related" subtitle="Link this task to a course, program or skill.">
        <RelatedPicker
          id="article-related"
          projectId={projectId}
          value={values.related}
          onChange={(s) => setField("related", s)}
          error={err("related")}
          legacyNote={!!values.relatedHadMultiple}
        />
      </Section>

      <Section id="sec-article-writer" title="Writer" subtitle="Who writes the article.">
        <Field id="article-writer" title="Writer" error={err("assignee")}>
          <PersonPicker
            id="article-writer"
            people={people.assignee}
            value={values.assignee}
            onChange={(v) => setField("assignee", v)}
            error={err("assignee")}
            emptyText="No project members write articles"
          />
        </Field>
      </Section>

      <RelatedAssetsCard
        idPrefix="article"
        subtitle="The clips, graphics, photos or articles this article uses."
        assets={values.relatedAssets ?? []}
        setAssets={(next) => setField("relatedAssets", next)}
        error={err("relatedAssets")}
      />

      <Section id="sec-article-timeline" title="Timeline" subtitle="When the work starts and is due.">
        <div className="flex flex-col gap-4">
          <DateTimeField
            id="article-start"
            title="Start Date"
            date={values.startDate}
            time={values.startTime}
            onDate={(v) => setField("startDate", v)}
            onTime={(v) => setField("startTime", v)}
            error={err("startAt")}
            hint="Time defaults to 09:00 (Bangkok)."
          />
          <DateTimeField
            id="article-due"
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
    </div>
  );
}
