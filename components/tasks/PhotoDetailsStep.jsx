"use client";

// Create / Edit Task — Step 2 "Task Detail" for Photo (Figma 169:963). Controlled
// by the drawer (values + setField). Cards: Folder & Photo Type · Related ·
// Work & Assign · Timeline. The save re-validates everything
// (lib/tasks/details.js parsePhotoDetails).
//   - Folder (round 36): FolderField, suffix P — New Folder (issued at creation)
//     or Choose Folder. Folder Name + Folder Location are the FOLDER's (shared by
//     every task in it; a chosen folder fills them, still editable).
//   - Photo Type: ONE option from the Photo Type list; a saved option that later
//     went inactive still shows and stays valid.
//   - Camera Man = the task's assignee; Editor = details.editor. Both list only
//     members whose role may do Photo.
//   - Shoot Date / Output Date = the task's start / due (09:00 / 18:00 Bangkok).

import { Camera } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { input } from "@/components/projects/ProjectForm";
import { DateTimeField, Field, Section } from "@/components/tasks/DetailBlocks";
import FolderField, { folderShareCount } from "@/components/tasks/FolderField";
import PersonPicker from "@/components/tasks/PersonPicker";
import RelatedPicker from "@/components/tasks/RelatedPicker";
import { FOLDER_LOCATION_MAX, FOLDER_NAME_MAX } from "@/lib/tasks/folders";

/** Empty Step 2 values (also the shape posted as `details` JSON). */
export const emptyPhotoDetails = () => ({
  folder: { mode: "new", folderId: "" },
  folderName: "",
  folderLocation: "",
  photoType: "",
  related: null,
  assignee: "", // Camera Man
  editor: "",
  startDate: "", // Shoot Date
  startTime: "",
  dueDate: "", // Output Date
  dueTime: "",
});

/**
 * @param {{ values: object, setField: (field: string, value: unknown) => void,
 *           errors: Record<string, string>, projectId: string, isEdit: boolean,
 *           options: { photo_type: object[] }, folders: object[],
 *           people: { assignee: object[], editor: object[] } }} props
 */
export default function PhotoDetailsStep({ values, setField, errors, projectId, isEdit, options, people, folders = [] }) {
  const err = (f) => errors[f];
  const photoTypes = options.photo_type ?? [];
  const choices = photoTypes.filter((o) => o.active || o.id === values.photoType);
  const selected = choices.find((o) => o.id === values.photoType) ?? null;
  const shared = folderShareCount(values.folder, values.currentFolderId ?? "", folders);

  return (
    <div className="flex flex-col gap-4">
      <Section id="sec-photo-folder" title="Folder & Photo Type" subtitle="Where the photos are kept and what kind of shoot this is.">
        {/* Round 37: Folder ID on its own full-width row; name + location below, full width. */}
        <div className="flex flex-col gap-4">
          <FolderField
            idPrefix="photo"
            suffix="P"
            isEdit={isEdit}
            value={values.folder}
            currentFolderId={values.currentFolderId ?? ""}
            folders={folders}
            onChange={(next, row) => {
              setField("folder", next);
              // A chosen folder brings its shared name + location (still editable).
              if (row) {
                setField("folderName", row.name ?? "");
                setField("folderLocation", row.location ?? "");
              }
            }}
            error={err("folder")}
          />
          <Field id="photo-folder-name" title="Folder Name" error={err("folderName")}>
            <input
              id="photo-folder-name"
              maxLength={FOLDER_NAME_MAX}
              placeholder="Folder Name"
              value={values.folderName}
              onChange={(e) => setField("folderName", e.target.value)}
              className={input}
              autoComplete="off"
              aria-invalid={!!err("folderName") || undefined}
              aria-describedby="photo-folder-name-error"
            />
          </Field>
        </div>
        <Field
          id="photo-folder-location"
          title="Folder Location"
          error={err("folderLocation")}
          hint={shared > 1 ? `Shared by ${shared} tasks` : undefined}
        >
          <input
            id="photo-folder-location"
            maxLength={FOLDER_LOCATION_MAX}
            placeholder="\\192.x.x.x\SocialMedia\Photo"
            value={values.folderLocation}
            onChange={(e) => setField("folderLocation", e.target.value)}
            className={input}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!err("folderLocation") || undefined}
            aria-describedby="photo-folder-location-error"
          />
        </Field>
        <Field
          id="photo-type"
          title="Photo Type"
          required
          error={err("photoType")}
          hint={choices.length === 0 ? "No photo types yet — add them in Team Management → Task Options." : undefined}
        >
          <Combobox
            id="photo-type"
            value={selected}
            onChange={(o) => setField("photoType", o?.id ?? "")}
            options={choices}
            renderValue={(o) => <span className="truncate">{o.label}</span>}
            labelledBy="photo-type-label"
            leadingIcon={Camera}
            placeholder="Choose a photo type"
            emptyText={photoTypes.length ? "No matches" : "No photo types yet"}
            listLabel="Photo types"
            invalid={!!err("photoType")}
            describedBy="photo-type-error"
          />
        </Field>
      </Section>

      <Section id="sec-photo-related" title="Related" subtitle="Link this task to a course, program or skill.">
        <RelatedPicker
          id="photo-related"
          projectId={projectId}
          value={values.related}
          onChange={(s) => setField("related", s)}
          error={err("related")}
          legacyNote={!!values.relatedHadMultiple}
        />
      </Section>

      <Section id="sec-photo-work" title="Work & Assign" subtitle="Who shoots and who edits the photos.">
        <Field id="photo-camera-man" title="Camera Man" error={err("assignee")}>
          <PersonPicker
            id="photo-camera-man"
            people={people.assignee}
            value={values.assignee}
            onChange={(v) => setField("assignee", v)}
            error={err("assignee")}
            emptyText="No project members work on photos"
          />
        </Field>
        <Field id="photo-editor" title="Editor" error={err("editor")}>
          <PersonPicker
            id="photo-editor"
            people={people.editor ?? []}
            value={values.editor}
            onChange={(v) => setField("editor", v)}
            error={err("editor")}
            emptyText="No project members work on photos"
          />
        </Field>
      </Section>

      {/* Stacked like Graphic: date + time side by side need the full drawer width. */}
      <Section id="sec-photo-timeline" title="Timeline" subtitle="When the shoot happens and when the photos are due.">
        <div className="flex flex-col gap-4">
          <DateTimeField
            id="photo-shoot"
            title="Shoot Date"
            date={values.startDate}
            time={values.startTime}
            onDate={(v) => setField("startDate", v)}
            onTime={(v) => setField("startTime", v)}
            error={err("startAt")}
            hint="Time defaults to 09:00 (Bangkok)."
          />
          <DateTimeField
            id="photo-output"
            title="Output Date"
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
