"use client";

// Shared task folder field (rounds 36–37; Figma 148:1062 + 206:118) for Graphic
// (G) and Photo (P). Rules: lib/tasks/folders.js; the server re-validates the
// choice (lib/tasks/details.js parseFolder) and issues a Folder ID ONLY for an
// explicit "New Folder". Choose Folder is only a reference to an existing folder.
//   Create:                 New Folder | Choose Folder (New pre-selected).
//   Edit, task WITH folder: the Folder ID (copy) + "Change folder" → the Choose
//                           list with a Cancel link. Never a new number.
//   Edit, task WITHOUT one: New Folder | Choose Folder, nothing selected until
//                           the user picks (New issues once, on save).
// The Choose list: this project's folders with this suffix that hold ≥ 1 task,
// newest first. No × buttons: a picked folder shows with "Choose another".
// `value` = { mode: "new" | "choose" | "keep" | "none", folderId }; picking a
// folder also hands its row to the caller (to fill the folder name / location).

import { useState } from "react";
import { Check, Copy, FolderOpen, Lock } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { FieldError, label } from "@/components/projects/ProjectForm";

/** How many tasks will share the folder after saving (for the "Shared by N tasks" hint). */
export function folderShareCount(value, currentFolderId, folders) {
  if (!value || value.mode === "new" || value.mode === "none") return 1;
  const id = value.mode === "keep" ? currentFolderId : value.folderId;
  const row = folders.find((f) => f.folderId === id);
  if (!row) return id ? 1 : 0;
  return row.taskCount + (id === currentFolderId ? 0 : 1);
}

const box = "flex min-h-11 w-full items-center gap-2 rounded-[10px] border border-line bg-card-inset py-1.5 pl-3 pr-1.5 text-sm";
const textButton =
  "shrink-0 rounded-[8px] px-2.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-card focus-visible:outline-2 focus-visible:outline-brand-500";

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

/** Choose list (full width). A picked folder shows as a row with "Choose another". */
function FolderPicker({ id, suffix, folders, folderId, onPick, error, exclude }) {
  const choices = exclude ? folders.filter((f) => f.folderId !== exclude) : folders;
  const selected = choices.find((f) => f.folderId === folderId) ?? null;
  if (selected) {
    return (
      <div className={box} role="group" aria-labelledby={`${id}-label`}>
        <FolderOpen className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-mono font-semibold text-fg">{selected.folderId}</span>
          <span className="text-fg-muted"> · {selected.label.slice(selected.folderId.length + 3)}</span>
        </span>
        <button type="button" onClick={() => onPick(null)} className={textButton}>
          Choose another
        </button>
      </div>
    );
  }
  if (choices.length === 0) {
    return (
      <div id={id} aria-disabled="true" className={`${box} text-fg-muted opacity-70`}>
        <FolderOpen className="size-4 shrink-0" aria-hidden="true" />
        No {exclude ? "other " : ""}folders in this project yet
      </div>
    );
  }
  return (
    <Combobox
      id={id}
      value={null}
      onChange={(row) => row && onPick(row)}
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
      labelledBy={`${id}-label`}
      leadingIcon={FolderOpen}
      placeholder={`Choose a ${suffix} folder in this project`}
      emptyText="No matching folders"
      listLabel={`${suffix} folders in this project`}
      invalid={!!error}
      describedBy={`${id}-error`}
    />
  );
}

/** New Folder | Choose Folder — one line, equal halves. `mode` "none" = neither picked. */
function ModeToggle({ mode, onMode }) {
  return (
    <div role="radiogroup" aria-label="Folder" className="grid w-full grid-cols-2 gap-1 rounded-[10px] bg-card-inset p-1">
      {[
        ["new", "New Folder"],
        ["choose", "Choose Folder"],
      ].map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={mode === key}
          onClick={() => onMode(key)}
          className={`min-h-9 whitespace-nowrap rounded-[8px] px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
            mode === key ? "bg-accent-soft font-semibold text-accent-fg" : "text-fg-muted hover:text-fg"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const NewFolderBox = ({ id }) => (
  <div id={id} className={box} role="group" aria-labelledby={`${id}-label`}>
    <Lock className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
    <span className="min-w-0 flex-1 text-fg-muted">Assigned automatically when the task is created</span>
  </div>
);

/**
 * @param {{ idPrefix: string, suffix: string, isEdit: boolean,
 *           value: { mode: "new" | "choose" | "keep" | "none", folderId: string },
 *           currentFolderId?: string, folders: object[],
 *           onChange: (value: object, row: object | null) => void, error?: string }} props
 */
export default function FolderField({ idPrefix, suffix, isEdit, value, currentFolderId = "", folders, onChange, error }) {
  const id = `${idPrefix}-folder`;
  const mode = value?.mode ?? (isEdit ? (currentFolderId ? "keep" : "none") : "new");
  const [changing, setChanging] = useState(isEdit && !!currentFolderId && mode === "choose");

  const setMode = (m) => onChange({ mode: m, folderId: "" }, null);
  const pickRow = (row) => onChange({ mode: "choose", folderId: row?.folderId ?? "" }, row);

  // Edit, task already has a folder: show it; "Change folder" → choose another.
  if (isEdit && currentFolderId) {
    const cancel = () => {
      setChanging(false);
      onChange({ mode: "keep", folderId: currentFolderId }, null);
    };
    return (
      <div className="min-w-0">
        <p id={`${id}-label`} className={label}>Folder ID</p>
        {!changing ? (
          <div className={box} role="group" aria-labelledby={`${id}-label`}>
            <FolderOpen className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-mono font-semibold text-fg">{currentFolderId}</span>
            <CopyId folderId={currentFolderId} />
            <button type="button" onClick={() => setChanging(true)} className={textButton}>
              Change folder
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <FolderPicker
              id={id}
              suffix={suffix}
              folders={folders}
              folderId={mode === "choose" ? value.folderId : ""}
              onPick={pickRow}
              error={error}
              exclude={currentFolderId}
            />
            <p className="text-xs text-fg-muted">
              Now in <span className="font-mono">{currentFolderId}</span>.{" "}
              <button type="button" onClick={cancel} className="rounded font-semibold text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
                Cancel
              </button>
            </p>
          </div>
        )}
        <FieldError id={`${id}-error`} error={error} />
      </div>
    );
  }

  // Create, or Edit of a task without a folder.
  return (
    <div className="min-w-0">
      <p id={`${id}-label`} className={label}>Folder ID</p>
      <div className="flex flex-col gap-2">
        <ModeToggle mode={mode} onMode={setMode} />
        {mode === "new" && <NewFolderBox id={id} />}
        {mode === "choose" && (
          <FolderPicker id={id} suffix={suffix} folders={folders} folderId={value.folderId} onPick={pickRow} error={error} />
        )}
        {mode === "none" && (
          <p className="text-xs text-fg-muted">
            No folder yet. Pick <span className="font-semibold">New Folder</span> to issue one when you save, or choose an existing folder.
          </p>
        )}
        {isEdit && mode !== "none" && (
          <p className="text-xs">
            <button type="button" onClick={() => setMode("none")} className="rounded font-semibold text-accent-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
              Leave without a folder
            </button>
          </p>
        )}
      </div>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}
