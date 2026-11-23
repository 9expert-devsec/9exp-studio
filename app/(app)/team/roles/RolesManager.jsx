"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  btnDanger,
  btnPrimary,
  btnRow,
  btnSecondary,
  card,
  errorText,
  input,
  label,
  pill,
  td,
  th,
} from "@/components/team/styles";
import { isFullAccessRole } from "@/lib/permissionRules";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "./actions";

// Mirrors models/Role.js (not imported: that module pulls Mongoose into the client).
// UX only; the server actions re-validate everything.
const KEY_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 300;

function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[^a-z]+/, "")
    .slice(0, 32)
    .replace(/-+$/, "");
}

function deleteBlockReason(role) {
  if (role.isSystem || isFullAccessRole(role.key)) return "System role: cannot be deleted.";
  if (role.accountCount > 0) {
    return `In use by ${role.accountCount} account${role.accountCount === 1 ? "" : "s"}.`;
  }
  return null;
}

// Superadmin and Manager have full access fixed in code (lib/permissionRules.js):
// their Role settings are never read, so they are shown, not edited.
const FULL_ACCESS_LABEL = "Full access";

/** Short summary for the table: "All" (not configured) or the chosen labels. */
function settingSummary(keys, options) {
  if (keys === null) return "All";
  if (keys.length === 0) return "None";
  return options.filter((o) => keys.includes(o.key)).map((o) => o.label).join(", ");
}

export default function RolesManager({ roles, taskTypeOptions, permissionOptions }) {
  // { type: "add" } | { type: "edit", role } | { type: "delete", role } | null
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);
  const existingKeys = roles.map((r) => r.key);

  return (
    <section aria-labelledby="roles-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="roles-heading" className="text-lg font-semibold text-fg">
            Roles
          </h2>
          <p className="text-sm text-fg-muted">
            Each account has exactly one role. A role sets which task types its people work on and what they may review.
          </p>
        </div>
        <button type="button" onClick={() => setModal({ type: "add" })} className={btnPrimary}>
          <Plus className="size-4" aria-hidden="true" />
          Add role
        </button>
      </div>

      {roles.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-brand-500">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-fg-muted">
            No roles yet — run{" "}
            <code className="rounded bg-card-inset px-1.5 py-0.5 font-mono text-xs text-fg">
              npm run seed-roles
            </code>
          </p>
          <button type="button" onClick={() => setModal({ type: "add" })} className={btnSecondary}>
            <Plus className="size-4" aria-hidden="true" />
            Add role
          </button>
        </div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={th}>Name</th>
                <th scope="col" className={th}>Key</th>
                <th scope="col" className={th}>Description</th>
                <th scope="col" className={th}>Task types</th>
                <th scope="col" className={th}>Review</th>
                <th scope="col" className={`${th} text-right`}>Accounts</th>
                <th scope="col" className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {roles.map((role) => {
                const blocked = deleteBlockReason(role);
                const reasonId = `delete-reason-${role.id}`;
                return (
                  <tr key={role.id}>
                    <td className={td}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-fg">{role.name}</span>
                        {role.isSystem && <span className={pill.brand}>System</span>}
                      </span>
                    </td>
                    <td className={`${td} font-mono text-xs text-fg-muted`}>
                      {role.key}
                    </td>
                    <td className={`${td} max-w-xs text-fg-muted`}>
                      {role.description || <span className="text-fg-muted">—</span>}
                    </td>
                    <td className={`${td} max-w-48 text-xs text-fg-muted`}>
                      {isFullAccessRole(role.key) ? FULL_ACCESS_LABEL : settingSummary(role.taskTypes, taskTypeOptions)}
                    </td>
                    <td className={`${td} max-w-40 text-xs text-fg-muted`}>
                      {isFullAccessRole(role.key) ? FULL_ACCESS_LABEL : settingSummary(role.permissions, permissionOptions)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{role.accountCount}</td>
                    <td className={`${td} text-right`}>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ type: "edit", role })}
                            className={btnRow}
                            aria-label={`Edit ${role.name}`}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={!!blocked}
                            aria-describedby={blocked ? reasonId : undefined}
                            onClick={() => setModal({ type: "delete", role })}
                            className={`${btnRow} hover:text-danger`}
                            aria-label={`Delete ${role.name}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                        {blocked && (
                          <span id={reasonId} className="text-xs text-fg-muted">
                            {blocked}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal?.type === "add"} onClose={close} title="Add role">
        <RoleForm existingKeys={existingKeys} onDone={close} taskTypeOptions={taskTypeOptions} permissionOptions={permissionOptions} />
      </Modal>

      <Modal open={modal?.type === "edit"} onClose={close} title="Edit role">
        {modal?.type === "edit" && (
          <RoleForm role={modal.role} onDone={close} taskTypeOptions={taskTypeOptions} permissionOptions={permissionOptions} />
        )}
      </Modal>

      <Modal
        open={modal?.type === "delete"}
        onClose={close}
        title="Delete role?"
        description={
          modal?.type === "delete"
            ? `“${modal.role.name}” (${modal.role.key}) will be permanently deleted.`
            : undefined
        }
      >
        {modal?.type === "delete" && <DeleteRoleConfirm role={modal.role} onDone={close} />}
      </Modal>
    </section>
  );
}

/**
 * One role setting: "All (not configured)" or "Only the selected" + checkboxes.
 * `value`: null (all) or the selected keys.
 */
function SettingField({ legend, hint, name, options, value, onChange }) {
  const limited = value !== null;
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-medium text-fg">{legend}</legend>
      <p className="text-xs text-fg-muted">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg">
        <label className="inline-flex items-center gap-2">
          <input type="radio" name={`${name}-mode`} checked={!limited} onChange={() => onChange(null)} className="size-4 accent-brand-500" />
          All (not configured)
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name={`${name}-mode`} checked={limited} onChange={() => onChange([])} className="size-4 accent-brand-500" />
          Only the selected
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.key}
            className={`inline-flex items-center gap-2 text-sm ${limited ? "text-fg" : "text-fg-muted"}`}
          >
            <input
              type="checkbox"
              disabled={!limited}
              checked={limited && value.includes(o.key)}
              onChange={() => toggle(o.key)}
              className="size-4 accent-brand-500"
            />
            {o.label}
            {o.enabled === false && <span className="text-xs text-fg-muted">(coming soon)</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Add when `role` is undefined; edit otherwise (key stays locked).
function RoleForm({ role, existingKeys = [], onDone, taskTypeOptions, permissionOptions }) {
  const isEdit = !!role;
  const fullAccess = isEdit && isFullAccessRole(role.key);
  const [taskTypes, setTaskTypes] = useState(role?.taskTypes ?? null);
  const [permissions, setPermissions] = useState(role?.permissions ?? null);
  const [name, setName] = useState(role?.name ?? "");
  const [key, setKey] = useState(role?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState(role?.description ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const keyValue = isEdit || keyTouched ? key : slugify(name);
  const keyInvalid = !isEdit && keyValue.length > 0 && !KEY_PATTERN.test(keyValue);
  const keyTaken = !isEdit && existingKeys.includes(keyValue);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", description);
    if (isEdit) fd.set("id", role.id);
    else fd.set("key", keyValue);
    fd.set("taskTypesMode", taskTypes === null ? "all" : "limited");
    (taskTypes ?? []).forEach((k) => fd.append("taskTypes", k));
    fd.set("permissionsMode", permissions === null ? "all" : "limited");
    (permissions ?? []).forEach((k) => fd.append("permissions", k));

    startTransition(async () => {
      const result = isEdit ? await updateRoleAction(fd) : await createRoleAction(fd);
      if (result?.ok) onDone();
      else setError(result?.error ?? "Something went wrong.");
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="role-name" className={label}>Name</label>
        <input
          id="role-name"
          required
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="role-key" className={label}>Key</label>
        {isEdit ? (
          <>
            <input
              id="role-key"
              value={role.key}
              readOnly
              aria-describedby="role-key-hint"
              className={`${input} cursor-default bg-card-inset font-mono`}
            />
            <p id="role-key-hint" className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-muted">
              <Lock className="size-3" aria-hidden="true" />
              The key cannot change: accounts reference it.
            </p>
          </>
        ) : (
          <>
            <input
              id="role-key"
              required
              maxLength={32}
              value={keyValue}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(e.target.value.toLowerCase());
              }}
              aria-invalid={keyInvalid || keyTaken || undefined}
              aria-describedby="role-key-hint"
              className={`${input} font-mono`}
              autoComplete="off"
              spellCheck={false}
            />
            <p
              id="role-key-hint"
              aria-live="polite"
              className={`mt-1.5 text-xs ${
                keyInvalid || keyTaken ? "text-danger" : "text-fg-muted"
              }`}
            >
              {keyTaken
                ? "This key is already used by another role."
                : "Lowercase letter first, then a–z, 0–9, - or _ (2–32 characters). Cannot change after saving."}
            </p>
          </>
        )}
      </div>

      <div>
        <label htmlFor="role-description" className={label}>
          Description <span className="font-normal text-fg-muted">(optional)</span>
        </label>
        <textarea
          id="role-description"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${input} resize-y`}
        />
      </div>

      {fullAccess ? (
        <p className="rounded-xl bg-card-inset p-4 text-sm text-fg-muted">
          <span className="font-medium text-fg">{FULL_ACCESS_LABEL}.</span> {role.name} always has every
          task type and permission, across the whole app.
        </p>
      ) : (
        <>
          <SettingField
            legend="Task types"
            hint="Task types this role works on. Leave unconfigured to allow all."
            name="role-task-types"
            options={taskTypeOptions}
            value={taskTypes}
            onChange={setTaskTypes}
          />
          <SettingField
            legend="Review permissions"
            hint="What this role may review. Leave unconfigured to allow all."
            name="role-permissions"
            options={permissionOptions}
            value={permissions}
            onChange={setPermissions}
          />
        </>
      )}

      <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
        <button
          type="submit"
          disabled={pending || !name.trim() || (!isEdit && (!keyValue || keyInvalid || keyTaken))}
          className={btnPrimary}
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isEdit ? "Save changes" : "Add role"}
        </button>
      </div>
    </form>
  );
}

function DeleteRoleConfirm({ role, onDone }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    setError("");
    const fd = new FormData();
    fd.set("id", role.id);
    startTransition(async () => {
      const result = await deleteRoleAction(fd);
      if (result?.ok) onDone();
      else setError(result?.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={btnSecondary} data-autofocus>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={pending} className={btnDanger}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Delete role
        </button>
      </div>
    </div>
  );
}
