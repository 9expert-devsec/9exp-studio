"use client";

// Shared "Related Assets" card + picker (Post, Article). Links other Clip /
// Graphic / Photo / Article tasks from ANY project (round 31 ruling). Values hold
// live rows { id, type, typeLabel, folderId, title, projectName, assigneeName,
// status, statusLabel, group }; the server stores ids only and re-validates
// (lib/tasks/assets.js validateRelatedAssets: ≤ 20, unique, allowed types, not
// itself). `showAssetStatus` adds the derived Status Asset chip (Post only).

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { searchRelatedAssetsAction } from "@/app/(app)/projects/task-actions";
import { StatusChip } from "@/components/projects/ProjectBits";
import AssetStatusChip from "@/components/tasks/AssetStatusChip";
import Modal from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { FieldError, input } from "@/components/projects/ProjectForm";
import { RELATED_ASSETS_MAX, deriveAssetStatus } from "@/lib/tasks/assets";
import { ASSET_TASK_TYPE_KEYS, assetStatusLabel, getTaskType } from "@/lib/tasks/types";

function TypeTile({ type }) {
  const Icon = getTaskType(type)?.icon;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-card-inset text-fg-muted">
      {Icon && <Icon className="size-5" aria-hidden="true" />}
    </span>
  );
}

/** One asset row (selected list, picker results, Task Detail): tile · "<Folder ID> <title>" · "Project · Assignee" · status. */
export function AssetRow({ a }) {
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

/** Search (title / Folder ID), type chips, multi-select; Done applies. */
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
 * @param {{ idPrefix: string, subtitle: string, assets: object[],
 *           setAssets: (next: object[] | ((cur: object[]) => object[])) => void,
 *           error?: string, showAssetStatus?: boolean }} props
 */
export default function RelatedAssetsCard({ idPrefix, subtitle, assets, setAssets, error, showAssetStatus = false }) {
  const [picking, setPicking] = useState(false);
  const headingId = `${idPrefix}-assets-heading`;
  const labelId = `${idPrefix}-assets-label`;
  const assetKey = showAssetStatus ? deriveAssetStatus(assets) : null;

  return (
    <section aria-labelledby={headingId} className="rounded-[16px] border border-line bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-base font-bold text-fg">Related Assets</h3>
          <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
        </div>
        <button type="button" onClick={() => setPicking(true)} className={buttonClass("outline", "min-h-9 shrink-0")}>
          <Plus className="size-4" aria-hidden="true" />
          Select Assets
        </button>
      </div>
      <div className="my-4 h-px bg-line-subtle" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={labelId} className="text-sm font-medium text-fg">Selected Assets ({assets.length})</p>
        {assetKey && (
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            Status Asset
            <AssetStatusChip status={assetKey} label={assetStatusLabel("post", assetKey)} />
          </span>
        )}
      </div>
      {assets.length === 0 ? (
        <p className="mt-3 rounded-[12px] bg-card-inset py-5 text-center text-sm text-fg-muted">No assets linked yet.</p>
      ) : (
        <ul aria-labelledby={labelId} className="mt-3 flex flex-col gap-2">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2.5">
              <AssetRow a={a} />
              <button
                type="button"
                onClick={() => setAssets((cur) => (cur ?? []).filter((x) => x.id !== a.id))}
                aria-label={`Remove ${a.title}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-fg-muted hover:bg-card-inset hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <FieldError id={`${idPrefix}-assets-error`} error={error} />
      <Modal open={picking} onClose={() => setPicking(false)} title="Select assets" description="Clip, Graphic, Photo or Article tasks from any project.">
        {picking && (
          <AssetPicker
            selected={assets}
            onCancel={() => setPicking(false)}
            onApply={(rows) => {
              setAssets(rows);
              setPicking(false);
            }}
          />
        )}
      </Modal>
    </section>
  );
}
