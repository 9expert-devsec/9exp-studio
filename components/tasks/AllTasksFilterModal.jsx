"use client";

// All Tasks filter modal (round 56, Figma 386:1663). The selection here is a
// PENDING draft (form state, mounted fresh from the URL each time the modal
// opens); nothing reaches the URL until "แสดงผล N งาน". N is a live server count
// (countAllTasksAction) for the draft + the current tab and search.
//   ประเภท Task  multi chips (catalog names)      กลุ่มสถานะ  5 stages + ยกเลิก/หยุด
//   Due          one choice; กำหนดเอง… → from / to (native date inputs, as elsewhere)
//   โปรเจกต์     searchable, visible projects only  ผู้รับผิดชอบ  searchable, "ฉัน" first

import { useEffect, useId, useState } from "react";
import { Check, FolderKanban, UserRound } from "lucide-react";
import { countAllTasksAction } from "@/app/(app)/all-tasks/actions";
import { input } from "@/components/projects/ProjectForm";
import { ProjectIconTile } from "@/components/projects/ProjectBits";
import Avatar from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import Combobox from "@/components/ui/Combobox";
import Modal from "@/components/ui/Modal";
import { ALL_TASKS_DUE, EMPTY_MODAL_FILTERS, allTasksQuery, modalFilters, modalRows } from "@/lib/tasks/allTasksFilters";
import { createLatestGuard } from "@/lib/tasks/panelUrl";
import { STOPPED_STAGE, TASK_STAGES, enabledTaskTypes } from "@/lib/tasks/types";

const COUNT_DEBOUNCE_MS = 250;
const ME = { id: "me", label: "ฉัน", avatarUrl: null };

export default function AllTasksFilterModal({ open, onClose, f, projects, people, onApply }) {
  return (
    <Modal open={open} onClose={onClose} title="ตัวกรอง" size="md">
      <FilterForm f={f} projects={projects} people={people} onClose={onClose} onApply={onApply} />
    </Modal>
  );
}

function Chip({ selected, onClick, dot, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 ${
        selected ? "border-brand-500 bg-accent-soft font-medium text-accent-fg" : "border-line bg-card text-fg hover:bg-card-inset"
      }`}
    >
      {selected && <Check className="size-3.5" aria-hidden="true" />}
      {dot && <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />}
      {children}
    </button>
  );
}

function Section({ title, hint, children }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-sm font-semibold text-fg">
        {title}
        {hint && <span className="ml-2 text-xs font-normal text-fg-muted">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

const toggleIn = (list, key, order) => (list.includes(key) ? list.filter((x) => x !== key) : order.filter((x) => x === key || list.includes(x)));

function FilterForm({ f, projects, people, onClose, onApply }) {
  const [draft, setDraft] = useState(() => modalFilters(f));
  const set = (changes) => setDraft((d) => ({ ...d, ...changes }));
  const id = useId();

  // Live count for the draft (debounced; only the latest answer counts).
  const [count, setCount] = useState(null);
  const [guard] = useState(createLatestGuard);
  const query = allTasksQuery(f, draft);
  useEffect(() => {
    const t = setTimeout(() => {
      const token = guard.begin();
      countAllTasksAction(query, f.scope)
        .then((res) => guard.isCurrent(token) && setCount(res?.ok ? res.count : null))
        .catch(() => guard.isCurrent(token) && setCount(null));
    }, COUNT_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      guard.cancel();
    };
  }, [query, guard, f.scope]);

  const typeOrder = enabledTaskTypes().map((t) => t.key);
  // Round 58: My Workspace hides rows (no ผู้รับผิดชอบ, no stop chip; done: no status / Due).
  const rows = modalRows(f);
  const stageOrder = rows.stages ?? [];
  const personOptions = [ME, ...people];
  const project = projects.find((p) => p.id === draft.project) ?? null;
  const person = personOptions.find((p) => p.id === draft.who) ?? null;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <Section title="ประเภท Task" hint="เลือกได้หลายรายการ">
        {enabledTaskTypes().map((t) => (
          <Chip key={t.key} selected={draft.types.includes(t.key)} onClick={() => set({ types: toggleIn(draft.types, t.key, typeOrder) })}>
            {t.label}
          </Chip>
        ))}
      </Section>

      {rows.stages && (
        <Section title="กลุ่มสถานะ" hint="ใช้ได้กับทุกประเภท">
          {[...TASK_STAGES, STOPPED_STAGE]
            .filter((s) => stageOrder.includes(s.key))
            .map((s) => (
              <Chip key={s.key} dot={s.dot} selected={draft.stages.includes(s.key)} onClick={() => set({ stages: toggleIn(draft.stages, s.key, stageOrder) })}>
                {s.label}
              </Chip>
            ))}
        </Section>
      )}

      {rows.due && (
      <Section title="Due">
        {ALL_TASKS_DUE.map((d) => (
          <Chip key={d.key || "all"} selected={draft.due === d.key} onClick={() => set({ due: d.key, ...(d.key === "custom" ? {} : { from: "", to: "" }) })}>
            {d.label}
          </Chip>
        ))}
      </Section>
      )}
      {rows.due && draft.due === "custom" && (
        <div className="-mt-2 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-fg-muted">
            ตั้งแต่
            <input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => set({ from: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-fg-muted">
            ถึง
            <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => set({ to: e.target.value })} className={input} />
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2.5">
          <span id={`${id}-project`} className="text-sm font-semibold text-fg">
            โปรเจกต์
          </span>
          <Combobox
            id={`${id}-project-input`}
            value={project}
            onChange={(p) => set({ project: p?.id ?? "" })}
            options={projects}
            renderOption={(p) => (
              <span className="flex min-w-0 items-center gap-2">
                {p.icon && <ProjectIconTile icon={p.icon} size="sm" className="size-6! rounded-[7px]!" />}
                <span className="truncate">{p.label}</span>
              </span>
            )}
            labelledBy={`${id}-project`}
            leadingIcon={FolderKanban}
            placeholder="ทุกโปรเจกต์"
            emptyText="ไม่พบโปรเจกต์"
            listLabel="โปรเจกต์"
          />
        </div>
        {rows.who && (
        <div className="flex min-w-0 flex-col gap-2.5">
          <span id={`${id}-who`} className="text-sm font-semibold text-fg">
            ผู้รับผิดชอบ
          </span>
          <Combobox
            id={`${id}-who-input`}
            value={person}
            onChange={(p) => set({ who: p?.id ?? "" })}
            options={personOptions}
            renderOption={(p) => (
              <span className="flex min-w-0 items-center gap-2">
                {p.id === "me" ? (
                  <UserRound className="size-5 shrink-0 text-accent-fg" aria-hidden="true" />
                ) : (
                  <Avatar name={p.label} url={p.avatarUrl} size={22} />
                )}
                <span className="truncate">{p.label}</span>
              </span>
            )}
            labelledBy={`${id}-who`}
            leadingIcon={UserRound}
            placeholder="ทุกคน"
            emptyText="ไม่พบรายชื่อ"
            listLabel="ผู้รับผิดชอบ"
          />
        </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setDraft(EMPTY_MODAL_FILTERS)}
          className="rounded px-1 text-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          ล้างทั้งหมด
        </button>
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={onClose} className={buttonClass("secondary", "min-h-10")}>
            ยกเลิก
          </button>
          <button type="submit" data-autofocus className={buttonClass("primary", "min-h-10 normal-case tracking-normal")}>
            แสดงผล {count ?? "…"} งาน
          </button>
        </span>
      </div>
    </form>
  );
}
