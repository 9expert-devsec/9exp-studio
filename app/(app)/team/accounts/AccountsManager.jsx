"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, KeyRound, Loader2, LockOpen, Pencil, Plus, Search, UserPlus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PasswordChoice, { passwordChoiceError } from "@/components/team/PasswordChoice";
import TempPasswordNotice from "@/components/team/TempPasswordNotice";
import {
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
import Avatar from "@/components/ui/Avatar";
import AvatarUploader from "@/components/ui/AvatarUploader";
import {
  createAccountAction,
  resetPasswordAction,
  removeAccountAvatarAction,
  unlockAccountAction,
  updateAccountAvatarAction,
  updateAccountAction,
} from "./actions";

const STATUS = {
  active: { label: "Active", className: pill.green },
  inactive: { label: "Inactive", className: pill.slate },
  locked: { label: "Locked", className: pill.amber },
};

export default function AccountsManager({ accounts, roles, meId }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // { type: "add" | "edit" | "reset", account? } | null
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  const [rowError, setRowError] = useState("");
  const [unlockingId, setUnlockingId] = useState(null);
  const [, startUnlock] = useTransition();

  // Role filter options: DB roles plus any unknown keys still referenced by accounts.
  const unknownKeys = [...new Set(accounts.filter((a) => !a.roleKnown).map((a) => a.roleKey))];

  const q = query.trim().toLowerCase();
  const visible = accounts.filter(
    (a) =>
      (!q || a.name.toLowerCase().includes(q) || a.email.includes(q)) &&
      (!roleFilter || a.roleKey === roleFilter) &&
      (!statusFilter || a.status === statusFilter)
  );

  const unlock = (account) => {
    setRowError("");
    setUnlockingId(account.id);
    const fd = new FormData();
    fd.set("id", account.id);
    startUnlock(async () => {
      const result = await unlockAccountAction(fd);
      if (!result?.ok) setRowError(result?.error ?? "Could not unlock the account.");
      setUnlockingId(null);
    });
  };

  return (
    <section aria-labelledby="accounts-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="accounts-heading" className="text-lg font-semibold text-fg">
            Accounts
          </h2>
          <p className="text-sm text-fg-muted">
            {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: "add" })}
          disabled={roles.length === 0}
          title={roles.length === 0 ? "Add a role first (Roles tab)" : undefined}
          className={btnPrimary}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add account
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
          <label htmlFor="account-search" className="sr-only">Search by name or email</label>
          <input
            id="account-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className={`${input} pl-9`}
          />
        </div>
        <div className="flex gap-3">
          <label htmlFor="role-filter" className="sr-only">Filter by role</label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`${input} sm:w-44`}
          >
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>{r.name}</option>
            ))}
            {unknownKeys.map((k) => (
              <option key={k} value={k}>{k} (unknown)</option>
            ))}
          </select>
          <label htmlFor="status-filter" className="sr-only">Filter by status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${input} sm:w-40`}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="locked">Locked</option>
          </select>
        </div>
      </div>

      <p role="alert" className={rowError ? errorText : "sr-only"}>{rowError}</p>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={th}>Account</th>
              <th scope="col" className={th}>Role</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}>Last sign-in</th>
              <th scope="col" className={th}>Created</th>
              <th scope="col" className={`${th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className={`${td} py-10 text-center text-fg-muted`}>
                  {accounts.length === 0 ? "No accounts yet." : "No accounts match these filters."}
                </td>
              </tr>
            )}
            {visible.map((a) => (
              <tr key={a.id}>
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <Avatar name={a.name} url={a.avatarUrl} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">
                        {a.name}
                        {a.id === meId && (
                          <span className="ml-2 text-xs font-normal text-fg-muted">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-fg-muted">{a.email}</p>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-fg">{a.roleName}</span>
                    {!a.roleKnown && (
                      <span className={pill.amber}>
                        <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
                        Unknown role
                      </span>
                    )}
                  </span>
                </td>
                <td className={td}>
                  <span className={STATUS[a.status].className}>{STATUS[a.status].label}</span>
                </td>
                <td className={`${td} whitespace-nowrap text-fg-muted`}>{a.lastLoginLabel}</td>
                <td className={`${td} whitespace-nowrap text-fg-muted`}>{a.createdLabel}</td>
                <td className={`${td} text-right`}>
                  <div className="flex justify-end gap-1">
                    {a.locked && (
                      <button
                        type="button"
                        onClick={() => unlock(a)}
                        disabled={unlockingId === a.id}
                        className={btnRow}
                        aria-label={`Unlock ${a.name}`}
                      >
                        {unlockingId === a.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <LockOpen className="size-3.5" aria-hidden="true" />
                        )}
                        Unlock
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModal({ type: "edit", account: a })}
                      className={btnRow}
                      aria-label={`Edit ${a.name}`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    {a.id !== meId && (
                      <button
                        type="button"
                        onClick={() => setModal({ type: "reset", account: a })}
                        className={btnRow}
                        aria-label={`Reset password for ${a.name}`}
                      >
                        <KeyRound className="size-3.5" aria-hidden="true" />
                        Reset password
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal?.type === "add"} onClose={close} title="Add account">
        <AddAccountForm roles={roles} onDone={close} />
      </Modal>

      <Modal open={modal?.type === "edit"} onClose={close} title="Edit account">
        {modal?.type === "edit" && (
          <EditAccountForm
            account={modal.account}
            // Fresh from props (refresh() after an avatar change re-sends the list).
            avatarUrl={accounts.find((x) => x.id === modal.account.id)?.avatarUrl ?? null}
            roles={roles}
            isSelf={modal.account.id === meId}
            onDone={close}
          />
        )}
      </Modal>

      <Modal
        open={modal?.type === "reset"}
        onClose={close}
        title="Reset password?"
        description={
          modal?.type === "reset"
            ? `${modal.account.name} (${modal.account.email}) gets a new password. Their current password stops working, the account is unlocked, and they must change it at their next sign-in.`
            : undefined
        }
      >
        {modal?.type === "reset" && <ResetPasswordFlow account={modal.account} onDone={close} />}
      </Modal>
    </section>
  );
}

// Result screen after create/reset. Generated passwords are shown ONCE; a chosen
// password is never echoed back. Takes focus because it replaces the form.
function ProvisionResult({ intro, result, onDone }) {
  if (result.password) {
    return (
      <div className="flex flex-col gap-4">
        {intro}
        {result.warning && <p role="alert" className="text-sm text-warning">{result.warning}</p>}
        <TempPasswordNotice password={result.password} onDone={onDone} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {intro}
      {result.warning && <p role="alert" className="text-sm text-warning">{result.warning}</p>}
      <p className="text-sm text-fg-muted">
        Share the password you set securely. The person must change it the first time they sign in.
      </p>
      <DoneButton onDone={onDone} />
    </div>
  );
}

function DoneButton({ onDone }) {
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <button ref={ref} type="button" onClick={onDone} className={`${btnPrimary} sm:self-end`}>
      Done
    </button>
  );
}

function AddAccountForm({ roles, onDone }) {
  const [photo, setPhoto] = useState(null); // prepared Blob from AvatarUploader (deferred)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [passwordMode, setPasswordMode] = useState("generate");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [pending, startTransition] = useTransition();

  if (result) {
    return (
      <ProvisionResult
        result={result}
        onDone={onDone}
        intro={
          <p className="text-sm text-fg">
            Account created for <strong>{name.trim()}</strong> ({email.trim().toLowerCase()}).
          </p>
        }
      />
    );
  }

  const choiceError = passwordChoiceError(passwordMode, password, passwordConfirm);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (choiceError) {
      setError(choiceError);
      return;
    }
    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);
    fd.set("role", role);
    fd.set("passwordMode", passwordMode);
    if (passwordMode === "set") {
      fd.set("password", password);
      fd.set("passwordConfirm", passwordConfirm);
    }
    if (photo) {
      const ext = photo.type === "image/webp" ? "webp" : "jpg";
      fd.set("avatar", new File([photo], `avatar.${ext}`, { type: photo.type }));
    }
    startTransition(async () => {
      const res = await createAccountAction(fd);
      if (res?.ok) {
        setPassword("");
        setPasswordConfirm("");
        setResult(res);
      } else {
        setError(res?.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <p className={label}>
          Profile photo <span className="font-normal text-fg-muted">(optional)</span>
        </p>
        <AvatarUploader name={name} size={96} deferred onPrepared={setPhoto} />
      </div>
      <div>
        <label htmlFor="acc-name" className={label}>Name</label>
        <input id="acc-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="acc-email" className={label}>Email</label>
        <input id="acc-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="off" spellCheck={false} />
      </div>
      <div>
        <label htmlFor="acc-role" className={label}>Role</label>
        <select id="acc-role" required value={role} onChange={(e) => setRole(e.target.value)} className={input}>
          <option value="" disabled>Choose a role…</option>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>{r.name}</option>
          ))}
        </select>
      </div>
      <PasswordChoice
        idPrefix="acc"
        mode={passwordMode}
        onModeChange={setPasswordMode}
        password={password}
        onPassword={setPassword}
        confirm={passwordConfirm}
        onConfirm={setPasswordConfirm}
      />
      <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
        <button
          type="submit"
          disabled={pending || !name.trim() || !email.trim() || !role || !!choiceError}
          className={btnPrimary}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
          Create account
        </button>
      </div>
    </form>
  );
}

function EditAccountForm({ account, avatarUrl, roles, isSelf, onDone }) {
  const [name, setName] = useState(account.name);
  const [role, setRole] = useState(account.roleKey);
  const [isActive, setIsActive] = useState(account.isActive);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("id", account.id);
    fd.set("name", name);
    fd.set("role", role);
    fd.set("isActive", isActive ? "true" : "false");
    startTransition(async () => {
      const result = await updateAccountAction(fd);
      if (result?.ok) onDone();
      else setError(result?.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Profile picture (96px); saved on its own, separate from the form below. */}
      <AvatarUploader
        name={account.name}
        url={avatarUrl}
        onSave={(fd) => {
          fd.set("id", account.id);
          return updateAccountAvatarAction(fd);
        }}
        onRemove={() => {
          const fd = new FormData();
          fd.set("id", account.id);
          return removeAccountAvatarAction(fd);
        }}
      />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="edit-email" className={label}>Email</label>
          <input id="edit-email" value={account.email} readOnly className={`${input} cursor-default bg-card-inset`} />
        </div>
        <div>
          <label htmlFor="edit-name" className={label}>Name</label>
          <input id="edit-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="edit-role" className={label}>Role</label>
          <select
            id="edit-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSelf}
            aria-describedby={isSelf ? "self-note" : undefined}
            className={input}
          >
            {!account.roleKnown && (
              <option value={account.roleKey} disabled>{account.roleKey} (unknown role)</option>
            )}
            {roles.map((r) => (
              <option key={r.key} value={r.key}>{r.name}</option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={isSelf}
            aria-describedby={isSelf ? "self-note" : "active-note"}
            className="size-4 accent-brand-500"
          />
          Active
        </label>
        {isSelf ? (
          <p id="self-note" className="-mt-2 text-xs text-fg-muted">
            You cannot change your own role or deactivate your own account.
          </p>
        ) : (
          <p id="active-note" className="-mt-2 text-xs text-fg-muted">
            Inactive accounts cannot sign in. Role and status changes reach an already
            signed-in user at their next sign-in.
          </p>
        )}
        <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={pending || !name.trim()} className={btnPrimary}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordFlow({ account, onDone }) {
  const [passwordMode, setPasswordMode] = useState("generate");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [pending, startTransition] = useTransition();

  if (result) {
    return (
      <ProvisionResult
        result={result}
        onDone={onDone}
        intro={<p className="text-sm text-fg">Password reset for <strong>{account.name}</strong>.</p>}
      />
    );
  }

  const choiceError = passwordChoiceError(passwordMode, password, passwordConfirm);

  const onConfirm = (e) => {
    e.preventDefault();
    setError("");
    if (choiceError) {
      setError(choiceError);
      return;
    }
    const fd = new FormData();
    fd.set("id", account.id);
    fd.set("passwordMode", passwordMode);
    if (passwordMode === "set") {
      fd.set("password", password);
      fd.set("passwordConfirm", passwordConfirm);
    }
    startTransition(async () => {
      const res = await resetPasswordAction(fd);
      if (res?.ok) {
        setPassword("");
        setPasswordConfirm("");
        setResult(res);
      } else {
        setError(res?.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <form onSubmit={onConfirm} noValidate className="flex flex-col gap-4">
      <PasswordChoice
        idPrefix="reset"
        mode={passwordMode}
        onModeChange={setPasswordMode}
        password={password}
        onPassword={setPassword}
        confirm={passwordConfirm}
        onConfirm={setPasswordConfirm}
      />
      <p role="alert" className={`min-h-5 ${errorText}`}>{error}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={pending || !!choiceError} className={btnPrimary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
          Reset password
        </button>
      </div>
    </form>
  );
}
