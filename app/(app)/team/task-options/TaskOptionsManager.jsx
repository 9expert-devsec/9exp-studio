"use client";

// Task option lists (superadmin): tabs per list (?list=), a table with ↑/↓
// reorder, label, icon (lists with icons), linked platforms (lists with
// platforms: Work Type), Active toggle, Edit, Delete. Add/edit in a Modal.
// Delete is blocked server-side while any task uses the option, or (platforms)
// while any work type links to it.
//
// Work Type tab: a platform filter (?platform=<id> | none), read from the URL by
// the page and passed in as `platformFilter` (not copied into state). Reorder is
// one global order, so ↑/↓ only work in the All view.

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ListPlus, Loader2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PlatformIcon from "@/components/tasks/PlatformIcon";
import { btnDanger, btnPrimary, btnRow, btnSecondary, card, errorText, input, label, pill, td, th } from "@/components/team/styles";
import {
  createTaskOptionAction,
  deleteTaskOptionAction,
  moveTaskOptionAction,
  toggleTaskOptionAction,
  updateTaskOptionAction,
} from "./actions";
import OptionTabs from "./OptionTabs";

const LABEL_MAX = 60;
const BASE = "/team/task-options";

const chipLink =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const chipOn = "border-brand-500 bg-accent-soft text-fg";
const chipOff = "border-line text-fg-muted hover:text-fg";

/** One linked platform, small (table cell). */
function PlatformChip({ p }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-fg">
      <PlatformIcon icon={p.icon} size={14} />
      {p.label}
      {!p.active && <span className="text-fg-muted">(inactive)</span>}
    </span>
  );
}

export default function TaskOptionsManager({ listKey, platformFilter = null, lists, extraTabs = [], options, marks }) {
  const list = lists.find((l) => l.key === listKey) ?? lists[0];
  const allRows = options[list.key] ?? [];
  const platforms = options.platform ?? []; // every platform option, in list order
  const platformById = new Map(platforms.map((p) => [p.id, p]));

  const filtered = !!(list.hasPlatforms && platformFilter);
  const rows = filtered
    ? allRows.filter((o) => (platformFilter === "none" ? o.platforms.length === 0 : o.platforms.includes(platformFilter)))
    : allRows;
  const unlinkedCount = list.hasPlatforms ? allRows.filter((o) => o.platforms.length === 0).length : 0;
  // Filter chips: active platforms + inactive ones some work type still links to.
  const filterPlatforms = platforms.filter((p) => p.active || p.linkedBy > 0);

  const [modal, setModal] = useState(null); // { type: "add" | "edit" | "delete", option? }
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const close = () => setModal(null);

  const run = (action, fields) => {
    setError("");
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(async () => {
      const res = await action(fd);
      if (!res?.ok) setError(res?.error ?? "Something went wrong.");
    });
  };

  const reorderTitle = filtered ? "Switch to All to reorder" : undefined;

  return (
    <section aria-labelledby="options-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="options-heading" className="text-lg font-semibold text-fg">Task Options</h2>
          <p className="text-sm text-fg-muted">Choices people pick from in task details. Inactive options leave the pickers but stay on tasks that use them.</p>
        </div>
        <button type="button" onClick={() => setModal({ type: "add" })} className={btnPrimary}>
          <Plus className="size-4" aria-hidden="true" />
          Add {list.label.toLowerCase()}
        </button>
      </div>

      <OptionTabs tabs={[...lists, ...extraTabs]} current={list.key} />

      {list.hasPlatforms && allRows.length > 0 && (
        <nav aria-label="Filter by platform">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link href={`${BASE}?list=${list.key}`} scroll={false} aria-current={!filtered ? "page" : undefined} className={`${chipLink} ${!filtered ? chipOn : chipOff}`}>
                All
              </Link>
            </li>
            {filterPlatforms.map((p) => (
              <li key={p.id}>
                <Link
                  href={`${BASE}?list=${list.key}&platform=${p.id}`}
                  scroll={false}
                  aria-current={platformFilter === p.id ? "page" : undefined}
                  className={`${chipLink} ${platformFilter === p.id ? chipOn : chipOff}`}
                >
                  <PlatformIcon icon={p.icon} size={16} />
                  {p.label}
                  {!p.active && <span className="text-xs">(inactive)</span>}
                </Link>
              </li>
            ))}
            {unlinkedCount > 0 && (
              <li>
                <Link
                  href={`${BASE}?list=${list.key}&platform=none`}
                  scroll={false}
                  aria-current={platformFilter === "none" ? "page" : undefined}
                  className={`${chipLink} ${platformFilter === "none" ? chipOn : chipOff}`}
                >
                  <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
                  No platform ({unlinkedCount})
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}

      <p role="alert" className={error ? errorText : "sr-only"}>{error}</p>

      {rows.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-brand-500">
            <ListPlus className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-fg-muted">
            {filtered ? `No ${list.label.toLowerCase()} options match this platform.` : `No ${list.label.toLowerCase()} options yet.`}
          </p>
        </div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={`${th} w-24`}>Order</th>
                <th scope="col" className={th}>Label</th>
                {list.hasIcon && <th scope="col" className={th}>Icon</th>}
                {list.hasPlatforms && <th scope="col" className={th}>Platforms</th>}
                <th scope="col" className={th}>Active</th>
                <th scope="col" className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((o, i) => (
                <tr key={o.id}>
                  <td className={td}>
                    <span className="flex gap-1" title={reorderTitle}>
                      <button
                        type="button"
                        disabled={pending || filtered || i === 0}
                        onClick={() => run(moveTaskOptionAction, { id: o.id, direction: "up" })}
                        className={btnRow}
                        title={reorderTitle}
                        aria-label={`Move ${o.label} up`}
                      >
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={pending || filtered || i === rows.length - 1}
                        onClick={() => run(moveTaskOptionAction, { id: o.id, direction: "down" })}
                        className={btnRow}
                        title={reorderTitle}
                        aria-label={`Move ${o.label} down`}
                      >
                        <ArrowDown className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                  <td className={td}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-fg">{o.label}</span>
                      {o.usedBy > 0 && (
                        <span className={pill.slate}>
                          {o.usedBy} {o.usedBy === 1 ? "task" : "tasks"}
                        </span>
                      )}
                      {o.linkedBy > 0 && (
                        <span className={pill.slate}>
                          {o.linkedBy} work {o.linkedBy === 1 ? "type" : "types"}
                        </span>
                      )}
                    </span>
                  </td>
                  {list.hasIcon && (
                    <td className={td}>
                      <span className="inline-flex items-center gap-2 text-fg-muted">
                        <PlatformIcon icon={o.icon} />
                        {marks.find((m) => m.key === o.icon)?.label ?? "—"}
                      </span>
                    </td>
                  )}
                  {list.hasPlatforms && (
                    <td className={td}>
                      {o.platforms.length === 0 ? (
                        <span className={`${pill.amber} gap-1`}>
                          <TriangleAlert className="size-3" aria-hidden="true" />
                          No platform — hidden from pickers
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          {o.platforms.map((id) => {
                            const p = platformById.get(id);
                            return p ? <PlatformChip key={id} p={p} /> : null;
                          })}
                        </span>
                      )}
                    </td>
                  )}
                  <td className={td}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={o.active}
                      aria-label={`${o.label} active`}
                      disabled={pending}
                      onClick={() => run(toggleTaskOptionAction, { id: o.id })}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60 ${
                        o.active ? "bg-brand-500" : "bg-track"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${o.active ? "translate-x-5.5" : "translate-x-0.5"}`}
                      />
                    </button>
                  </td>
                  <td className={`${td} text-right`}>
                    <span className="flex justify-end gap-1">
                      <button type="button" onClick={() => setModal({ type: "edit", option: o })} className={btnRow} aria-label={`Edit ${o.label}`}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ type: "delete", option: o })}
                        className={`${btnRow} hover:text-danger`}
                        aria-label={`Delete ${o.label}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal?.type === "add"} onClose={close} title={`Add ${list.label.toLowerCase()}`}>
        <OptionForm list={list} marks={marks} platforms={platforms} onDone={close} />
      </Modal>
      <Modal open={modal?.type === "edit"} onClose={close} title={`Edit ${list.label.toLowerCase()}`}>
        {modal?.type === "edit" && <OptionForm list={list} marks={marks} platforms={platforms} option={modal.option} onDone={close} />}
      </Modal>
      <Modal
        open={modal?.type === "delete"}
        onClose={close}
        closeOnBackdrop
        title="Delete option?"
        description={modal?.type === "delete" ? deleteDescription(modal.option) : undefined}
      >
        {modal?.type === "delete" && <DeleteConfirm option={modal.option} onDone={close} />}
      </Modal>
    </section>
  );
}

const isBlocked = (o) => o.usedBy > 0 || o.linkedBy > 0;

function deleteDescription(o) {
  if (o.linkedBy > 0) {
    return `“${o.label}” is linked to ${o.linkedBy} work ${o.linkedBy === 1 ? "type" : "types"} — unlink ${o.linkedBy === 1 ? "it" : "them"} or deactivate the platform instead.`;
  }
  if (o.usedBy > 0) {
    return `“${o.label}” is used by ${o.usedBy} ${o.usedBy === 1 ? "task" : "tasks"}, so it can't be deleted. Deactivate it instead.`;
  }
  return `“${o.label}” will be permanently deleted.`;
}

function OptionForm({ list, marks, platforms, option, onDone }) {
  const [text, setText] = useState(option?.label ?? "");
  const [icon, setIcon] = useState(option?.icon ?? (list.hasIcon ? marks[0].key : ""));
  const initialPlatforms = option?.platforms ?? [];
  const [linked, setLinked] = useState(initialPlatforms);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // Active platforms in list order, plus inactive ones already linked (so they can be unlinked).
  const choices = platforms.filter((p) => p.active || initialPlatforms.includes(p.id));
  const linkedValid = linked.filter((id) => choices.some((p) => p.id === id));
  const needsPlatforms = !!list.hasPlatforms && linkedValid.length === 0;

  const toggle = (id) => setLinked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("label", text);
    if (list.hasIcon) fd.set("icon", icon);
    if (list.hasPlatforms) for (const id of linkedValid) fd.append("platforms", id);
    if (option) fd.set("id", option.id);
    else fd.set("list", list.key);
    startTransition(async () => {
      const res = await (option ? updateTaskOptionAction(fd) : createTaskOptionAction(fd));
      if (res?.ok) onDone();
      else setError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="option-label" className={label}>Label</label>
        <input id="option-label" required maxLength={LABEL_MAX} value={text} onChange={(e) => setText(e.target.value)} className={input} autoComplete="off" />
      </div>
      {list.hasPlatforms && (
        <fieldset aria-describedby="option-platforms-help">
          <legend className={label}>
            Platforms <span className="text-danger" aria-hidden="true">*</span>
          </legend>
          <p id="option-platforms-help" className="-mt-0.5 mb-2 text-xs text-fg-muted">
            Choose every platform this work type is for. It appears in pickers for those platforms only.
          </p>
          {choices.length === 0 ? (
            <p className="text-sm text-fg-muted">No platforms yet — add one in the Platform tab first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {choices.map((p) => (
                <label
                  key={p.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 text-sm text-fg has-[:checked]:border-brand-500 has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500"
                >
                  <input type="checkbox" checked={linked.includes(p.id)} onChange={() => toggle(p.id)} className="peer sr-only" />
                  <PlatformIcon icon={p.icon} />
                  <span className="min-w-0 flex-1 truncate">
                    {p.label}
                    {!p.active && <span className="ml-1 text-xs text-fg-muted">inactive</span>}
                  </span>
                  <Check className="hidden size-4 shrink-0 text-brand-500 peer-checked:block" aria-hidden="true" />
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      {list.hasIcon && (
        <fieldset>
          <legend className={label}>Icon</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {marks.map((m) => (
              <label
                key={m.key}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 text-sm text-fg has-[:checked]:border-brand-500 has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500"
              >
                <input type="radio" name="option-icon" value={m.key} checked={icon === m.key} onChange={() => setIcon(m.key)} className="sr-only" />
                <PlatformIcon icon={m.key} />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending || !text.trim() || needsPlatforms} className={btnPrimary}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {option ? "Save changes" : "Add"}
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({ option, onDone }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const blocked = isBlocked(option);

  const confirm = () => {
    setError("");
    const fd = new FormData();
    fd.set("id", option.id);
    startTransition(async () => {
      const res = await deleteTaskOptionAction(fd);
      if (res?.ok) onDone();
      else setError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={btnSecondary} data-autofocus>
          {blocked ? "Close" : "Cancel"}
        </button>
        {!blocked && (
          <button type="button" onClick={confirm} disabled={pending} className={btnDanger}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
