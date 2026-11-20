"use client";

// Task Options → External Presenters (round 38, superadmin): the saved external
// people Production tasks use as Presenters. Rename, note, Active toggle, delete
// only while unused ("Used by N tasks"). New people are added from a Production
// task (Presenter → Add "<name>"); inactive ones leave the picker but stay on the
// tasks that use them. Every action is re-checked server-side (./actions.js).

import { useState, useTransition } from "react";
import { Loader2, Pencil, Trash2, UsersRound } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { btnDanger, btnPrimary, btnRow, btnSecondary, card, errorText, input, label, pill, td, th } from "@/components/team/styles";
import { EXTERNAL_NAME_MAX, EXTERNAL_NOTE_MAX } from "@/lib/tasks/production";
import { deleteExternalPersonAction, toggleExternalPersonAction, updateExternalPersonAction } from "./actions";
import OptionTabs from "./OptionTabs";

/** @param {{ tabs: object[], current: string, people: { id, name, note, active, usedBy }[] }} props */
export default function ExternalPresentersManager({ tabs, current, people }) {
  const [modal, setModal] = useState(null); // { type: "edit" | "delete", person }
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const close = () => setModal(null);

  const toggle = (p) => {
    setError("");
    const fd = new FormData();
    fd.set("id", p.id);
    startTransition(async () => {
      const res = await toggleExternalPersonAction(fd);
      if (!res?.ok) setError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <section aria-labelledby="options-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="options-heading" className="text-lg font-semibold text-fg">Task Options</h2>
        <p className="text-sm text-fg-muted">
          External presenters are added from a Production task (Presenter → Add “name”). Inactive people leave the picker but stay on tasks
          that use them.
        </p>
      </div>

      <OptionTabs tabs={tabs} current={current} />

      <p role="alert" className={error ? errorText : "sr-only"}>{error}</p>

      {people.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-brand-500">
            <UsersRound className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-fg-muted">No external presenters yet.</p>
        </div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={th}>Name</th>
                <th scope="col" className={th}>Note</th>
                <th scope="col" className={th}>Active</th>
                <th scope="col" className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {people.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-fg">{p.name}</span>
                      {p.usedBy > 0 && (
                        <span className={pill.slate}>
                          Used by {p.usedBy} {p.usedBy === 1 ? "task" : "tasks"}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`${td} max-w-xs truncate text-fg-muted`} title={p.note || undefined}>
                    {p.note || "—"}
                  </td>
                  <td className={td}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.active}
                      aria-label={`${p.name} active`}
                      disabled={pending}
                      onClick={() => toggle(p)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60 ${
                        p.active ? "bg-brand-500" : "bg-track"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${p.active ? "translate-x-5.5" : "translate-x-0.5"}`}
                      />
                    </button>
                  </td>
                  <td className={`${td} text-right`}>
                    <span className="flex justify-end gap-1">
                      <button type="button" onClick={() => setModal({ type: "edit", person: p })} className={btnRow} aria-label={`Edit ${p.name}`}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ type: "delete", person: p })}
                        className={`${btnRow} hover:text-danger`}
                        aria-label={`Delete ${p.name}`}
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

      <Modal open={modal?.type === "edit"} onClose={close} title="Edit external presenter">
        {modal?.type === "edit" && <PersonForm person={modal.person} onDone={close} />}
      </Modal>
      <Modal
        open={modal?.type === "delete"}
        onClose={close}
        closeOnBackdrop
        title="Delete external presenter?"
        description={
          modal?.type === "delete"
            ? modal.person.usedBy > 0
              ? `“${modal.person.name}” is used by ${modal.person.usedBy} ${modal.person.usedBy === 1 ? "task" : "tasks"}, so they can't be deleted. Deactivate them instead.`
              : `“${modal.person.name}” will be permanently deleted.`
            : undefined
        }
      >
        {modal?.type === "delete" && <DeleteConfirm person={modal.person} onDone={close} />}
      </Modal>
    </section>
  );
}

function PersonForm({ person, onDone }) {
  const [name, setName] = useState(person.name);
  const [note, setNote] = useState(person.note ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("id", person.id);
    fd.set("name", name);
    fd.set("note", note);
    startTransition(async () => {
      const res = await updateExternalPersonAction(fd);
      if (res?.ok) onDone();
      else setError(res?.error ?? "Something went wrong.");
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="external-name" className={label}>Name</label>
        <input id="external-name" required maxLength={EXTERNAL_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="external-note" className={label}>Note</label>
        <textarea
          id="external-note"
          rows={3}
          maxLength={EXTERNAL_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Guest speaker from Microsoft"
          className={`${input} min-h-20 py-2`}
        />
      </div>
      <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending || !name.trim()} className={btnPrimary}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save changes
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({ person, onDone }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const blocked = person.usedBy > 0;

  const confirm = () => {
    setError("");
    const fd = new FormData();
    fd.set("id", person.id);
    startTransition(async () => {
      const res = await deleteExternalPersonAction(fd);
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
