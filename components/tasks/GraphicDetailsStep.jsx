"use client";

// Create / Edit Task — Step 2 "Task Detail" for Graphic (Figma 148:1062).
// Controlled by the drawer (values + setField), so Back → Step 1 → Add details
// keeps everything. Cards: Platform & Work Type · Source & Asset · Brief &
// References · Related · Work & Assign · Reviewer Assign · Timeline. Option and
// candidate lists come from the server; the save re-validates all of it
// (lib/tasks/details.js parseGraphicDetails). The Folder ID is issued by the
// server at creation and is read-only here.

import { useState } from "react";
import { Check, Copy, FolderOpen, ImagePlus, Loader2, X } from "lucide-react";
import { deleteUnsavedTaskPhotoAction, signTaskPhotoUploadAction } from "@/app/(app)/projects/task-actions";
import Combobox from "@/components/ui/Combobox";
import { DateTimeField, Field, ReferenceField, Section } from "@/components/tasks/DetailBlocks";
import PersonPicker from "@/components/tasks/PersonPicker";
import PlatformIcon from "@/components/tasks/PlatformIcon";
import RelatedPicker from "@/components/tasks/RelatedPicker";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { FieldError, input, label } from "@/components/projects/ProjectForm";
import {
  GRAPHIC_FILE_LOCATION_MAX,
  GRAPHIC_ITEMS_MAX,
  GRAPHIC_PHOTO_MAX_BYTES,
  GRAPHIC_PHOTO_TYPES,
  GRAPHIC_PHOTOS_MAX,
} from "@/lib/tasks/graphic";
import { WORK_LEVELS } from "@/lib/tasks/types";

/** Empty Step 2 values (also the shape posted as `details` JSON). */
export const emptyGraphicDetails = () => ({
  platform: "",
  workType: "",
  items: 1,
  fileLocation: "",
  photos: [], // [{ url, publicId, width, height }]
  brief: "",
  referenceUrl: "",
  related: null,
  workLevel: "",
  assignee: "",
  contentReviewer: "",
  designReviewer: "",
  startDate: "",
  startTime: "",
  dueDate: "",
  dueTime: "",
});

const PlatformRow = ({ o }) => (
  <span className="flex min-w-0 items-center gap-2">
    <PlatformIcon icon={o.icon} />
    <span className="truncate">{o.label}</span>
  </span>
);

/** Read-only Folder ID: placeholder before creation, value + copy after. */
function FolderIdField({ folderId }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(folderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the ID is still selectable */
    }
  };
  return (
    <div className="min-w-0">
      <p id="graphic-folder-id-label" className={label}>Folder ID</p>
      <div
        role="group"
        aria-labelledby="graphic-folder-id-label"
        className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-card-inset py-1.5 pl-3 pr-1.5 text-sm"
      >
        <FolderOpen className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
        {folderId ? (
          <>
            <span className="min-w-0 flex-1 truncate font-mono font-semibold text-fg">{folderId}</span>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Folder ID copied" : `Copy Folder ID ${folderId}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-card hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            </button>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-fg-muted">Assigned automatically when the task is created</span>
        )}
      </div>
    </div>
  );
}

/** Cloudinary delivery URL → a small square thumbnail of the same asset. */
const thumbUrl = (url) => url.replace("/image/upload/", "/image/upload/c_fill,w_160,h_160,f_auto,q_auto/");

/**
 * Photos: up to 10 jpg/png/webp ≤ 10 MB. Each file uploads straight to Cloudinary
 * with a server-made signature (signTaskPhotoUploadAction); × removes it (an
 * unsaved upload is deleted at once; a saved one when the task is saved).
 */
function PhotoField({ projectId, photos, onChange, error }) {
  const [uploading, setUploading] = useState(0);
  const [localError, setLocalError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const room = GRAPHIC_PHOTOS_MAX - photos.length - uploading;

  const uploadOne = async (file) => {
    const signed = await signTaskPhotoUploadAction(projectId);
    if (!signed?.ok) throw new Error(signed?.error ?? "Upload isn't available right now.");
    const fd = new FormData();
    for (const [k, v] of Object.entries(signed.fields)) fd.set(k, v);
    fd.set("file", file);
    const res = await fetch(signed.uploadUrl, { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.secure_url || !json?.public_id) throw new Error("A photo could not be uploaded. Please try again.");
    return { url: json.secure_url, publicId: json.public_id, width: json.width ?? null, height: json.height ?? null };
  };

  const addFiles = async (fileList) => {
    setLocalError("");
    const files = [...fileList];
    const valid = files.filter((f) => GRAPHIC_PHOTO_TYPES.includes(f.type) && f.size > 0 && f.size <= GRAPHIC_PHOTO_MAX_BYTES);
    if (valid.length < files.length) setLocalError("Only JPG, PNG or WebP photos up to 10 MB each.");
    const take = valid.slice(0, Math.max(room, 0));
    if (valid.length > take.length) setLocalError(`You can add up to ${GRAPHIC_PHOTOS_MAX} photos.`);
    if (!take.length) return;
    setUploading((n) => n + take.length);
    const added = [];
    for (const file of take) {
      try {
        added.push(await uploadOne(file));
      } catch (err) {
        setLocalError(err.message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onChange((cur) => [...cur, ...added]);
  };

  const remove = (photo) => {
    onChange((cur) => cur.filter((p) => p.publicId !== photo.publicId));
    // The server deletes it only if no saved task uses it (saved ones go on save).
    void deleteUnsavedTaskPhotoAction(projectId, photo.publicId);
  };

  return (
    <div>
      <p id="graphic-photos-label" className={label}>Photo</p>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (room > 0) addFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed px-4 py-5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${
          dragOver ? "border-brand-500 bg-accent-soft" : "border-line hover:border-brand-500"
        } ${room <= 0 ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          type="file"
          multiple
          accept={GRAPHIC_PHOTO_TYPES.join(",")}
          disabled={room <= 0}
          aria-labelledby="graphic-photos-label"
          aria-describedby="graphic-photos-help graphic-photos-error"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <ImagePlus className="size-6 text-fg-muted" aria-hidden="true" />
        <span className="text-sm font-semibold text-fg">Upload Photo</span>
        <span id="graphic-photos-help" className="text-xs text-fg-muted">
          Drop or click · JPG, PNG, WebP · up to 10 MB each · {photos.length}/{GRAPHIC_PHOTOS_MAX}
        </span>
      </label>

      {(photos.length > 0 || uploading > 0) && (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Photos">
          {photos.map((p, i) => (
            <li key={p.publicId} className="relative aspect-square overflow-hidden rounded-[10px] border border-line bg-card-inset">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(p.url)} alt={`Photo ${i + 1}`} loading="lazy" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <li key={`up-${i}`} className="flex aspect-square items-center justify-center rounded-[10px] border border-dashed border-line">
              <Loader2 className="size-5 animate-spin text-fg-muted" aria-hidden="true" />
              <span className="sr-only">Uploading…</span>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="sr-only">{uploading > 0 ? `Uploading ${uploading} photo${uploading === 1 ? "" : "s"}…` : ""}</p>
      <FieldError id="graphic-photos-error" error={localError || error} />
    </div>
  );
}

/**
 * @param {{ values: object, setField: (field: string, value: unknown) => void,
 *           errors: Record<string, string>, projectId: string, isEdit: boolean,
 *           options: { platform: object[], work_type: object[] },
 *           people: { assignee: object[], contentReviewer: object[], designReviewer: object[] } }} props
 */
export default function GraphicDetailsStep({ values, setField, errors, projectId, isEdit, options, people }) {
  const err = (f) => errors[f];
  const platforms = options.platform ?? [];
  const workTypes = options.work_type ?? [];
  const selectedPlatform = platforms.find((o) => o.id === values.platform) ?? null;
  const platformChoices = platforms.filter((o) => o.active || o.id === values.platform);

  // Work types linked to the chosen platform (active; the stored one stays listed).
  const workTypesFor = (pid) => workTypes.filter((w) => (w.platforms ?? []).includes(pid) && (w.active || w.id === values.workType));
  const workTypeChoices = values.platform ? workTypesFor(values.platform) : [];
  const selectedWorkType = workTypeChoices.find((w) => w.id === values.workType) ?? null;

  const choosePlatform = (o) => {
    const pid = o?.id ?? "";
    setField("platform", pid);
    if (values.workType && !workTypesFor(pid).some((w) => w.id === values.workType)) setField("workType", "");
  };

  // Photos use a functional update (uploads finish asynchronously; never a stale list).
  const setPhotos = (update) => setField("photos", (cur) => update(cur ?? []));

  return (
    <div className="flex flex-col gap-4">
      <Section id="sec-graphic-platform" title="Platform & Work Type" subtitle="Select the platform and type of graphic work.">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6.5rem]">
          <Field id="graphic-platform" title="Platform" required error={err("platform")}>
            <Combobox
              id="graphic-platform"
              value={selectedPlatform}
              onChange={choosePlatform}
              options={platformChoices}
              renderOption={(o) => <PlatformRow o={o} />}
              renderValue={(o) => <PlatformRow o={o} />}
              labelledBy="graphic-platform-label"
              placeholder="Choose"
              emptyText={platforms.length ? "No matches" : "No platforms yet — ask an admin to add some."}
              listLabel="Platforms"
              invalid={!!err("platform")}
              describedBy="graphic-platform-error"
            />
          </Field>
          <Field
            id="graphic-work-type"
            title="Work Type"
            required
            error={err("workType")}
            hint={values.platform && workTypeChoices.length === 0 ? "No work types linked to this platform yet." : undefined}
          >
            {values.platform && workTypeChoices.length > 0 ? (
              <Combobox
                id="graphic-work-type"
                value={selectedWorkType}
                onChange={(o) => setField("workType", o?.id ?? "")}
                options={workTypeChoices}
                renderValue={(o) => <span className="truncate">{o.label}</span>}
                labelledBy="graphic-work-type-label"
                placeholder="Choose"
                listLabel="Work types"
                invalid={!!err("workType")}
                describedBy="graphic-work-type-error"
              />
            ) : (
              <input
                id="graphic-work-type"
                disabled
                placeholder={values.platform ? "None available" : "Choose a platform first"}
                className={input}
                aria-describedby="graphic-work-type-error"
              />
            )}
          </Field>
          <Field id="graphic-items" title="Items" required error={err("items")}>
            <input
              id="graphic-items"
              type="number"
              inputMode="numeric"
              min={1}
              max={GRAPHIC_ITEMS_MAX}
              step={1}
              value={values.items}
              onChange={(e) => setField("items", e.target.value === "" ? "" : Number(e.target.value))}
              className={input}
              aria-invalid={!!err("items") || undefined}
              aria-describedby="graphic-items-error"
            />
          </Field>
        </div>
      </Section>

      <Section id="sec-graphic-source" title="Source & Asset" subtitle="Where the files live, plus any photos to work from.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FolderIdField folderId={isEdit ? values.folderId : null} />
          <Field id="graphic-file-location" title="File Location" error={err("fileLocation")}>
            <input
              id="graphic-file-location"
              maxLength={GRAPHIC_FILE_LOCATION_MAX}
              placeholder="\\192.x.x.x\SocialMedia\Graphic"
              value={values.fileLocation}
              onChange={(e) => setField("fileLocation", e.target.value)}
              className={input}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!err("fileLocation") || undefined}
              aria-describedby="graphic-file-location-error"
            />
          </Field>
        </div>
        <PhotoField projectId={projectId} photos={values.photos ?? []} onChange={setPhotos} error={err("photos")} />
      </Section>

      <Section id="sec-graphic-brief" title="Brief & References" subtitle="Tell what it should be about and how it should look.">
        <div>
          <p id="graphic-brief-label" className={label}>Brief</p>
          <RichTextEditor
            id="graphic-brief"
            value={values.brief}
            onChange={(html) => setField("brief", html)}
            labelledBy="graphic-brief-label"
            describedBy="graphic-brief-error"
            invalid={!!err("brief")}
          />
          <FieldError id="graphic-brief-error" error={err("brief")} />
        </div>
        <ReferenceField
          id="graphic-reference"
          value={values.referenceUrl}
          onChange={(v) => setField("referenceUrl", v)}
          error={err("referenceUrl")}
        />
      </Section>

      <Section id="sec-graphic-related" title="Related" subtitle="Link this task to a course, program or skill.">
        <RelatedPicker
          id="graphic-related"
          projectId={projectId}
          value={values.related}
          onChange={(s) => setField("related", s)}
          error={err("related")}
          legacyNote={!!values.relatedHadMultiple}
        />
      </Section>

      <Section id="sec-graphic-work" title="Work & Assign" subtitle="Set the difficulty and who does the work.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="graphic-work-level" title="Work Level" required error={err("workLevel")}>
            <select
              id="graphic-work-level"
              value={values.workLevel}
              onChange={(e) => setField("workLevel", e.target.value)}
              className={input}
              aria-invalid={!!err("workLevel") || undefined}
              aria-describedby="graphic-work-level-error"
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
          <Field id="graphic-assignee" title="Assign to" error={err("assignee")}>
            <PersonPicker
              id="graphic-assignee"
              people={people.assignee}
              value={values.assignee}
              onChange={(v) => setField("assignee", v)}
              error={err("assignee")}
              emptyText="No project members work on graphics"
            />
          </Field>
        </div>
      </Section>

      <Section id="sec-graphic-review" title="Reviewer Assign" subtitle="Who checks the content and the design.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="graphic-content-review" title="Content Review" error={err("contentReviewer")}>
            <PersonPicker
              id="graphic-content-review"
              people={people.contentReviewer}
              value={values.contentReviewer}
              onChange={(v) => setField("contentReviewer", v)}
              error={err("contentReviewer")}
              emptyText="No project members can review content"
            />
          </Field>
          <Field id="graphic-design-review" title="Design Review" error={err("designReviewer")}>
            <PersonPicker
              id="graphic-design-review"
              people={people.designReviewer ?? []}
              value={values.designReviewer}
              onChange={(v) => setField("designReviewer", v)}
              error={err("designReviewer")}
              emptyText="No project members can review design"
            />
          </Field>
        </div>
      </Section>

      {/* Stacked (not 2 columns like the Figma): date + time side by side need the full drawer width. */}
      <Section id="sec-graphic-timeline" title="Timeline" subtitle="When the work starts and is due.">
        <div className="flex flex-col gap-4">
          <DateTimeField
            id="graphic-start"
            title="Start Date"
            date={values.startDate}
            time={values.startTime}
            onDate={(v) => setField("startDate", v)}
            onTime={(v) => setField("startTime", v)}
            error={err("startAt")}
            hint="Time defaults to 09:00 (Bangkok)."
          />
          <DateTimeField
            id="graphic-due"
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
