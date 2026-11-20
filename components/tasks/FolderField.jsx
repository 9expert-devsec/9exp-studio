"use client";

// Shared task folder field (round 36; Figma 148:1062 + 206:118) for Graphic (G)
// and Photo (P). Rules: lib/tasks/folders.js; the server re-validates the choice
// (lib/tasks/details.js parseFolder).
//   Create: New Folder | Choose Folder toggle (New is the default).
//     New    → a locked field: the ID is issued when the task is created.
//     Choose → a searchable list of THIS project's folders with this suffix,
//              newest first ("<id> · <name or newest task title>" · N tasks).
//   Edit:   no toggle (never a new number): the current Folder ID (copy) and
//           "Change folder" → the same list. A task without a folder (older
//           ones) may choose one.
// `value` = { mode: "new" | "choose" | "keep", folderId }; picking a folder also
// hands its row to the caller (to fill the folder name / location fields).

import { useState } from "react";
import { Check, Copy, FolderOpen, Lock, X } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { FieldError, label } from "@/components/projects/ProjectForm";

/** How many tasks will share the folder after saving (for the "Shared by N tasks" hint). */
export function folderShareCount(value, currentFolderId, folders) {
  if (!value || value.mode === "new") return 1;
  const id = value.mode === "keep" ? currentFolderId : value.folderId;
  const row = folders.find((f) => f.folderId === id);
  if (!row) return id ? 1 : 0;
  return row.taskCount + (id === currentFolderId ? 0 : 1);
}

const box = "flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-card-inset py-1.5 pl-3 pr-1.5 text-sm";

function CopyId({ folderId }) {
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
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Folder ID copied" : `Copy Folder ID ${folderId}`}
      className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-fg-muted transition-colors hover:bg-card hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
    </button>
  );
}

function FolderPicker({ id, suffix, folders, folderId, onPick, error, exclude }) {
  const choices = exclude ? folders.filter((f) => f.folderId !== exclude) : folders;
  if (choices.length === 0) {
    return (
      <div id={id} aria-disabled="true" className={`${box} text-fg-muted opacity-70`}>
        <FolderOpen className="size-4 shrink-0" aria-hidden="true" />
        No {exclude ? "other " : ""}folders in this project yet
      </div>
    );
  }
  const selected = choices.find((f) => f.folderId === folderId) ?? null;
  return (
    <Combobox
      id={id}
      value={selected}
      onChange={(row) => onPick(row)}
      options={choices}
      getLabel={(f) => f.label}
      renderOption={(f) => (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span className="min-w-0 truncate">{f.label}</span>
          <span className="shrink-0 text-xs text-fg-muted">
            {f.taskCount} {f.taskCount === 1 ? "task" : "tasks"}
          </span>
        </span>
      )}
      renderValue={(f) => <span className="truncate font-mono text-sm">{f.label}</span>}
      labelledBy={`${id}-label`}
      leadingIcon={FolderOpen}
      placeholder={`Choose Folder ${suffix} in this project`}
      emptyText="No matching folders"
      listLabel={`${suffix} folders in this project`}
      invalid={!!error}
      describedBy={`${id}-error`}
    />
  );
}

/**
 * @param {{ idPrefix: string, suffix: string, isEdit: boolean,
 *           value: { mode: "new" | "choose" | "keep", folderId: string },
 *           currentFolderId?: string, folders: object[],
 *           onChange: (value: object, row: object | null) => void, error?: string }} props
 */
export default function FolderField({ idPrefix, suffix, isEdit, value, currentFolderId = "", folders, onChange, error }) {
  const id = `${idPrefix}-folder`;
  const mode = value?.mode ?? (isEdit ? "keep" : "new");
  const [changing, setChanging] = useState(mode === "choose" && isEdit);

  const pick = (row) => onChange(row ? { mode: "choose", folderId: row.folderId } : { mode: isEdit ? "keep" : "choose", folderId: isEdit ? currentFolderId : "" }, row);

  if (isEdit) {
    const showPicker = changing || mode === "choose";
    return (
      <div className="min-w-0">
        <p id={`${id}-label`} className={label}>Folder ID</p>
        {!showPicker ? (
          <div className={box} role="group" aria-labelledby={`${id}-label`}>
            <FolderOpen className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            {currentFolderId ? (
              <>
                <span className="min-w-0 flex-1 truncate font-mono font-semibold text-fg">{currentFolderId}</span>
                <CopyId folderId={currentFolderId} />
              </>
            ) : (
              <span className="min-w-0 flex-1 text-fg-muted">No folder yet</span>
            )}
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-card focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {currentFolderId ? "Change folder" : "Choose folder"}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <FolderPicker
                id={id}
                suffix={suffix}
                folders={folders}
                folderId={mode === "choose" ? value.folderId : ""}
                onPick={pick}
                error={error}
                exclude={currentFolderId || null}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setChanging(false);
                onChange({ mode: "keep", folderId: currentFolderId }, null);
              }}
              aria-label="Keep the current folder"
              title="Keep the current folder"
              className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <FieldError id={`${id}-error`} error={error} />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p id={`${id}-label`} className={label}>Folder ID</p>
      <div role="radiogroup" aria-label="Folder" className="mb-2 inline-flex gap-1 rounded-[10px] bg-card-inset p-1">
        {[
          ["new", "New Folder"],
          ["choose", "Choose Folder"],
        ].map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={mode === key}
            onClick={() => onChange(key === "new" ? { mode: "new", folderId: "" } : { mode: "choose", folderId: "" }, null)}
            className={`min-h-8 rounded-[8px] px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
              mode === key ? "bg-accent-soft font-semibold text-accent-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      {mode === "new" ? (
        <div id={id} className={box} role="group" aria-labelledby={`${id}-label`}>
          <Lock className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-fg-muted">Assigned automatically when the task is created</span>
        </div>
      ) : (
        <FolderPicker id={id} suffix={suffix} folders={folders} folderId={value.folderId} onPick={pick} error={error} />
      )}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}
