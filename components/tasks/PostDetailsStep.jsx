"use client";

// Create / Edit Task — Step 2 "Task Detail" for Post (Figma 152:6).
// Controlled by the drawer (values + setField). Cards: Platform & Work Type ·
// Wording Post · Related · Assign Post · Related Assets · Schedule Post. The save
// re-validates everything (lib/tasks/details.js parsePostDetails).
//   - Post Type = the Work Type list filtered by platform (shared control).
//   - Related Assets: other Clip / Graphic / Photo / Article tasks from ANY
//     project, picked in a modal; values hold live rows, the server stores ids.
//   - Status Asset: derived from those assets (lib/tasks/assets.js), read-only.
//   - Schedule Post = the task's due date (Bangkok; date only → 18:00).

import { useEffect, useState } from "react";
import { CalendarDays, Check, Clock, Loader2, Plus, Search, X } from "lucide-react";
import { searchRelatedAssetsAction } from "@/app/(app)/projects/task-actions";
import { StatusChip } from "@/components/projects/ProjectBits";
import AssetStatusChip from "@/components/tasks/AssetStatusChip";
import { Field, Section } from "@/components/tasks/DetailBlocks";
import PersonPicker from "@/components/tasks/PersonPicker";
import PlatformWorkTypeFields from "@/components/tasks/PlatformWorkTypeFields";
import RelatedPicker from "@/components/tasks/RelatedPicker";
import Modal from "@/components/ui/Modal";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { buttonClass } from "@/components/ui/Button";
import { FieldError, input, label } from "@/components/projects/ProjectForm";
import { RELATED_ASSETS_MAX, deriveAssetStatus } from "@/lib/tasks/assets";
import { ASSET_TASK_TYPE_KEYS, assetStatusLabel, getTaskType } from "@/lib/tasks/types";

/** Empty Step 2 values (also the shape posted as `details` JSON). */
export const emptyPostDetails = () => ({
  platform: "",
  workType: "",
  brief: "",
  related: null,
  assignee: "",
  relatedAssets: [], // live rows: { id, type, typeLabel, folderId, title, projectName, assigneeName, status, statusLabel, group }
  dueDate: "",
  dueTime: "",
});

function TypeTile({ type }) {
  const Icon = getTaskType(type)?.icon;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-card-inset text-fg-muted">
      {Icon && <Icon className="size-5" aria-hidden="true" />}
    </span>
  );
}

/** One asset row (selected list + picker results): tile · "<Folder ID> <title>" · "Project · Assignee" · status. */
function AssetRow({ a }) {
  return (
    <>
      <TypeTile type={a.type} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">
          {a.folderId && <span className="mr-1.5 font-mono">{a.folderId}</span>}
          {a.title}
        </span>
        <span className="block truncate text-xs text-fg-muted">
          <span className="sr-only">{a.typeLabel} · </span>
          {a.projectName} · {a.assigneeName}
        </span>
      </span>
      <StatusChip status={a.group} label={a.statusLabel} />
    </>
  );
}

const TYPE_FILTERS = [{ key: "", label: "All" }, ...ASSET_TASK_TYPE_KEYS.map((k) => ({ key: k, label: getTaskType(k)?.label ?? k }))];

/** "+ Select Assets" modal: search (title / Folder ID), type chips, multi-select, Done applies. */
function AssetPickerModal({ open, onClose, selected, onApply }) {
  return (
    <Modal open={open} onClose={onClose} title="Select assets" description="Clip, Graphic, Photo or Article tasks from any project.">
      {open && <AssetPicker selected={selected} onApply={onApply} onCancel={onClose} />}
    </Modal>
  );
}

function AssetPicker({ selected, onApply, onCancel }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [result, setResult] = useState({ loading: true, rows: [], error: "" });
  // Picked rows by id (starts from the current selection; order kept).
  const [picked, setPicked] = useState(() => new Map(selected.map((a) => [a.id, a])));

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      setResult((r) => ({ ...r, loading: true }));
      const res = await searchRelatedAssetsAction(q, type);
      if (!live) return;
      setResult(res?.ok ? { loading: false, rows: res.results, error: "" } : { loading: false, rows: [], error: res?.error ?? "Search failed." });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, type]);

  const toggle = (row) =>
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(row.id)) next.delete(row.id);
      else if (next.size < RELATED_ASSETS_MAX) next.set(row.id, row);
      return next;
    });
  const full = picked.size >= RELATED_ASSETS_MAX;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // Inside the drawer's <form>: Enter must not submit (create) the task.
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Search task title or Folder ID"
          aria-label="Search assets"
          className={`${input} pl-9`}
          autoComplete="off"
          data-autofocus
        />
      </div>
      <div role="group" aria-label="Asset type" className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key || "all"}
            type="button"
            aria-pressed={type === f.key}
            onClick={() => setType(f.key)}
            className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
              type === f.key ? "border-brand-500 bg-accent-soft text-accent-fg" : "border-line text-fg-muted hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {result.loading ? "Searching…" : `${result.rows.length} results`}
      </p>
      <ul aria-label="Results" className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {result.loading && result.rows.length === 0 ? (
          <li className="flex items-center justify-center gap-2 py-8 text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Searching…
          </li>
        ) : result.error ? (
          <li className="py-8 text-center text-sm text-danger">{result.error}</li>
        ) : result.rows.length === 0 ? (
          <li className="py-8 text-center text-sm text-fg-muted">No matching tasks</li>
        ) : (
          result.rows.map((row) => {
            const checked = picked.has(row.id);
            return (
              <li key={row.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${
                    checked ? "border-brand-500 bg-accent-soft" : "border-line hover:bg-card-inset"
                  } ${!checked && full ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => toggle(row)}
                    className="size-4 shrink-0 accent-brand-500"
                    aria-label={`${row.typeLabel}: ${row.folderId ? `${row.folderId} ` : ""}${row.title}`}
                  />
                  <AssetRow a={row} />
                </label>
              </li>
            );
          })
        )}
      </ul>

      <div className="flex flex-col-reverse gap-2 border-t border-line-subtle pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-fg-muted">
          {picked.size} selected{full ? ` (max ${RELATED_ASSETS_MAX})` : ""}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="button" onClick={() => onApply([...picked.values()])} className={buttonClass("primary")}>
            <Check className="size-4" aria-hidden="true" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ values: object, setField: (field: string, value: unknown) => void,
 *           errors: Record<string, string>, projectId: string,
 *           options: { platform: object[], work_type: object[] },
 *           people: { assignee: object[] } }} props
 */
export default function PostDetailsStep({ values, setField, errors, projectId, options, people }) {
  const err = (f) => errors[f];
  const [picking, setPicking] = useState(false);
  const assets = values.relatedAssets ?? [];
  const assetKey = deriveAssetStatus(assets);

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

      <section aria-labelledby="sec-post-assets" className="rounded-[16px] border border-line bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="sec-post-assets" className="text-base font-bold text-fg">Related Assets</h3>
            <p className="mt-0.5 text-xs text-fg-muted">The clips, graphics, photos or articles this post uses.</p>
          </div>
          <button type="button" onClick={() => setPicking(true)} className={buttonClass("outline", "min-h-9 shrink-0")}>
            <Plus className="size-4" aria-hidden="true" />
            Select Assets
          </button>
        </div>
        <div className="my-4 h-px bg-line-subtle" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id="post-assets-label" className="text-sm font-medium text-fg">Selected Assets ({assets.length})</p>
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            Status Asset
            <AssetStatusChip status={assetKey} label={assetStatusLabel("post", assetKey)} />
          </span>
        </div>
        {assets.length === 0 ? (
          <p className="mt-3 rounded-[12px] bg-card-inset py-5 text-center text-sm text-fg-muted">No assets linked yet.</p>
        ) : (
          <ul aria-labelledby="post-assets-label" className="mt-3 flex flex-col gap-2">
            {assets.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2.5">
                <AssetRow a={a} />
                <button
                  type="button"
                  onClick={() => setField("relatedAssets", (cur) => (cur ?? []).filter((x) => x.id !== a.id))}
                  aria-label={`Remove ${a.title}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <FieldError id="post-assets-error" error={err("relatedAssets")} />
        <AssetPickerModal
          open={picking}
          onClose={() => setPicking(false)}
          selected={assets}
          onApply={(rows) => {
            setField("relatedAssets", rows);
            setPicking(false);
          }}
        />
      </section>

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
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              <input
                id="post-due-time"
                type="time"
                value={values.dueTime}
                disabled={!values.dueDate}
                onChange={(e) => setField("dueTime", e.target.value)}
                className={`${input} pl-9`}
                aria-describedby="post-due-hint"
              />
            </div>
          </Field>
        </div>
        <p id="post-due-hint" className="-mt-2 text-xs text-fg-muted">Time defaults to 18:00 (Bangkok).</p>
      </Section>
    </div>
  );
}
