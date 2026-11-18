"use client";

// Shared ONE-person picker (Assign to, Content Review, Video Review, …), reused by
// every task type's Step 2. Empty: a searchable list of `people`. Picked: the
// search box is replaced by one full-width row (avatar, name, role muted, ×
// "Remove <name>") — × clears it and brings the search back, focused.
//
// A person flagged `ineligible` (a stored pick who no longer qualifies; see
// lib/projects/queries.js loadTaskDrawer) still shows in the row, with a hint.
//
// people: [{ id, name, email, avatarUrl, roleLabel, ineligible? }]
// Field label: give it id `${id}-label` (names the value row).

import { TriangleAlert, UserRound } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Combobox from "@/components/ui/Combobox";

function PersonOption({ p }) {
  return (
    <>
      <Avatar name={p.name} url={p.avatarUrl} size={24} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{p.name}</span>
        {(p.roleLabel || p.email) && (
          <span className="block truncate text-xs text-fg-muted">{[p.roleLabel, p.email].filter(Boolean).join(" · ")}</span>
        )}
      </span>
    </>
  );
}

function PersonValue({ p }) {
  return (
    <>
      <Avatar name={p.name} url={p.avatarUrl} size={28} />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate font-medium text-fg">{p.name}</span>
        {p.roleLabel && <span className="shrink-0 truncate text-xs text-fg-muted">{p.roleLabel}</span>}
      </span>
    </>
  );
}

export default function PersonPicker({ id, people, value, onChange, error, emptyText = "No one to choose" }) {
  const selected = people.find((p) => p.id === value) ?? null;
  const warningId = `${id}-warning`;
  return (
    <>
      <Combobox
        id={id}
        value={selected}
        onChange={(p) => onChange(p?.id ?? "")}
        options={people}
        getLabel={(p) => p.name}
        renderOption={(p) => <PersonOption p={p} />}
        renderValue={(p) => <PersonValue p={p} />}
        labelledBy={`${id}-label`}
        leadingIcon={UserRound}
        placeholder="Search people"
        emptyText={emptyText}
        listLabel="People"
        invalid={!!error}
        describedBy={selected?.ineligible ? `${warningId} ${id}-error` : `${id}-error`}
      />
      {selected?.ineligible && (
        <p id={warningId} className="mt-1.5 flex items-center gap-1.5 text-xs text-warning">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          No longer eligible for this role — choose someone else or keep as is
        </p>
      )}
    </>
  );
}
