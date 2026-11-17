"use client";

// Task option lists (superadmin): tabs per list (?list=), a table with ↑/↓
// reorder, label, icon (lists with icons), Active toggle, Edit, Delete. Add/edit
// in a Modal. Delete is blocked server-side while any task uses the option.

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ListPlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PlatformMark from "@/components/tasks/PlatformMark";
import { btnDanger, btnPrimary, btnRow, btnSecondary, card, errorText, input, label, pill, td, th } from "@/components/team/styles";
import {
  createTaskOptionAction,
  deleteTaskOptionAction,
  moveTaskOptionAction,
  toggleTaskOptionAction,
  updateTaskOptionAction,
} from "./actions";

const LABEL_MAX = 60;

export default function TaskOptionsManager({ listKey, lists, options, marks }) {
  const list = lists.find((l) => l.key === listKey) ?? lists[0];
  const rows = options[list.key] ?? [];
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

      <nav aria-label="Option lists">
        <ul className="inline-flex gap-1 rounded-full border border-control-line bg-control p-1">
          {lists.map((l) => (
            <li key={l.key}>
              <Link
                href={`/team/task-options?list=${l.key}`}
                scroll={false}
                aria-current={l.key === list.key ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  l.key === list.key ? "bg-brand-500 text-navy" : "text-fg-muted hover:text-fg"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p role="alert" className={error ? errorText : "sr-only"}>{error}</p>

      {rows.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-brand-500">
            <ListPlus className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-fg-muted">No {list.label.toLowerCase()} options yet.</p>
        </div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={`${th} w-24`}>Order</th>
                <th scope="col" className={th}>Label</th>
                {list.hasIcon && <th scope="col" className={th}>Icon</th>}
                <th scope="col" className={th}>Active</th>
                <th scope="col" className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((o, i) => (
                <tr key={o.id}>
                  <td className={td}>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        disabled={pending || i === 0}
                        onClick={() => run(moveTaskOptionAction, { id: o.id, direction: "up" })}
                        className={btnRow}
                        aria-label={`Move ${o.label} up`}
                      >
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={pending || i === rows.length - 1}
                        onClick={() => run(moveTaskOptionAction, { id: o.id, direction: "down" })}
                        className={btnRow}
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
                    </span>
                  </td>
                  {list.hasIcon && (
                    <td className={td}>
                      <span className="inline-flex items-center gap-2 text-fg-muted">
                        <PlatformMark icon={o.icon} />
                        {marks.find((m) => m.key === o.icon)?.label ?? "—"}
                      </span>
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
        <OptionForm list={list} marks={marks} onDone={close} />
      </Modal>
      <Modal open={modal?.type === "edit"} onClose={close} title={`Edit ${list.label.toLowerCase()}`}>
        {modal?.type === "edit" && <OptionForm list={list} marks={marks} option={modal.option} onDone={close} />}
      </Modal>
      <Modal
        open={modal?.type === "delete"}
        onClose={close}
        closeOnBackdrop
        title="Delete option?"
        description={
          modal?.type === "delete"
            ? modal.option.usedBy > 0
              ? `“${modal.option.label}” is used by ${modal.option.usedBy} ${modal.option.usedBy === 1 ? "task" : "tasks"}, so it can't be deleted. Deactivate it instead.`
              : `“${modal.option.label}” will be permanently deleted.`
            : undefined
        }
      >
        {modal?.type === "delete" && <DeleteConfirm option={modal.option} onDone={close} />}
      </Modal>
    </section>
  );
}

function OptionForm({ list, marks, option, onDone }) {
  const [text, setText] = useState(option?.label ?? "");
  const [icon, setIcon] = useState(option?.icon ?? (list.hasIcon ? marks[0].key : ""));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("label", text);
    if (list.hasIcon) fd.set("icon", icon);
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
                <PlatformMark icon={m.key} />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending || !text.trim()} className={btnPrimary}>
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
  const blocked = option.usedBy > 0;

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
