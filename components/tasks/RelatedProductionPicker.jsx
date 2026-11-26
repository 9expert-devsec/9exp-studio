"use client";

// Clip Step 2 "Related Production" (round 45): ONE Production task of this
// project, in the single-person picker style (components/tasks/PersonPicker.jsx):
// empty → a searchable list (title or task number); picked → one row with a ×.
// Rows: queries.js loadTaskDrawer `productions` — { id, title, numberLabel,
// contentName, statusLabel, group, dueLabel }. The save re-validates
// (lib/tasks/clipFlow.js relatedProductionError).

import { Clapperboard } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { StatusChip } from "@/components/projects/ProjectBits";

function Tile() {
  return (
    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-card-inset text-fg-muted">
      <Clapperboard className="size-4" />
    </span>
  );
}

const meta = (p) => [`TASK ${p.numberLabel}`, p.contentName, p.dueLabel ? `Due ${p.dueLabel}` : ""].filter(Boolean).join(" · ");

function ProductionOption({ p }) {
  return (
    <>
      <Tile />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{p.title}</span>
        <span className="block truncate text-xs text-fg-muted">{meta(p)}</span>
      </span>
      <StatusChip status={p.group} label={p.statusLabel} />
    </>
  );
}

function ProductionValue({ p }) {
  return (
    <>
      <Tile />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate font-medium text-fg">{p.title}</span>
        <span className="shrink-0 truncate text-xs text-fg-muted">{p.dueLabel ? `Due ${p.dueLabel}` : `TASK ${p.numberLabel}`}</span>
      </span>
      <StatusChip status={p.group} label={p.statusLabel} />
    </>
  );
}

export default function RelatedProductionPicker({ id, productions, value, onChange, error }) {
  const selected = productions.find((p) => p.id === value) ?? null;
  return (
    <Combobox
      id={id}
      value={selected}
      onChange={(p) => onChange(p?.id ?? "")}
      options={productions}
      // Search matches the title or the task number ("TASK 03").
      getLabel={(p) => `${p.title} · TASK ${p.numberLabel}`}
      renderOption={(p) => <ProductionOption p={p} />}
      renderValue={(p) => <ProductionValue p={p} />}
      labelledBy={`${id}-label`}
      leadingIcon={Clapperboard}
      placeholder="Search Production tasks"
      emptyText={productions.length ? "No matches" : "No Production tasks in this project yet"}
      listLabel="Production tasks"
      invalid={!!error}
      describedBy={`${id}-error`}
    />
  );
}
