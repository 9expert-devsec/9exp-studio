// Production task people (round 38) — pure rules (no DB). Shared by the server
// (lib/tasks/details.js, the task actions, read models), the activity diff and
// node checks.
//
// details.videographers  [userId]                       ≥ 0, ≤ 10, Studio accounts
// details.presenters     [{ kind: "user", id }          a Studio account (any active one)
//                         | { kind: "external", id }]   a saved ExternalPerson
// Posted (not stored): { kind: "external", name } = "Add <name> as external
// presenter" — the create/update action turns it into an ExternalPerson id
// (reusing one with the same nameKey; never a duplicate).
// The task's assignee is ALWAYS the first videographer (or null).

import { isHttpUrl } from "../projects/rules.js";

export const PRODUCTION_PEOPLE_MAX = 10;
export const EXTERNAL_NAME_MAX = 100;
export const EXTERNAL_NOTE_MAX = 300;

const str = (v) => (typeof v === "string" ? v : "");

/** Display form of an external name: trimmed, inner whitespace collapsed. */
export const cleanExternalName = (name) => str(name).trim().replace(/\s+/g, " ");

/** Unique key of an external person: trimmed, lower-cased, spaces collapsed. */
export const externalNameKey = (name) => cleanExternalName(name).toLowerCase();

/**
 * Shape-check the posted people (no DB). `isId` validates an ObjectId string.
 * Duplicates are dropped (first wins); a new external name that equals another
 * new one (same nameKey) is dropped too.
 * @returns {{ videographers: string[], presenters: ({ kind: "user"|"external", id: string } | { kind: "external", name: string })[],
 *             errors: Record<string, string> }}
 */
export function readProductionPeople(input, isId) {
  const errors = {};
  // Videographers: ids, or the picker's { kind: "user", id } entries.
  const rawV = Array.isArray(input?.videographers) ? input.videographers : [];
  const videographers = [...new Set(rawV.map((v) => str(v && typeof v === "object" ? v.id : v)))].filter(Boolean);
  if (videographers.length > PRODUCTION_PEOPLE_MAX) errors.videographers = `Choose at most ${PRODUCTION_PEOPLE_MAX} videographers.`;
  else if (!videographers.every(isId)) errors.videographers = "Choose videographers from the list.";

  const rawP = Array.isArray(input?.presenters) ? input.presenters : [];
  const seen = new Set();
  const presenters = [];
  for (const p of rawP) {
    if (!p || typeof p !== "object") continue;
    const kind = str(p.kind);
    const id = str(p.id);
    if ((kind === "user" || kind === "external") && id) {
      if (!isId(id)) {
        errors.presenters = "Choose presenters from the list.";
        continue;
      }
      const key = `${kind}:${id}`;
      if (!seen.has(key)) presenters.push({ kind, id });
      seen.add(key);
    } else if (kind === "external") {
      const name = cleanExternalName(p.name);
      if (!name) continue;
      if (name.length > EXTERNAL_NAME_MAX) {
        errors.presenters = `External names can be at most ${EXTERNAL_NAME_MAX} characters.`;
        continue;
      }
      const key = `new:${externalNameKey(name)}`;
      if (!seen.has(key)) presenters.push({ kind: "external", name });
      seen.add(key);
    } else {
      errors.presenters = "Choose presenters from the list.";
    }
  }
  if (presenters.length > PRODUCTION_PEOPLE_MAX) errors.presenters = `Choose at most ${PRODUCTION_PEOPLE_MAX} presenters.`;
  return { videographers, presenters, errors };
}

const URL_MAX = 2000;

/** Script Reference / File Record: optional http(s) links. */
export function readProductionLinks(input) {
  const errors = {};
  const read = (field) => {
    const url = str(input?.[field]).trim();
    if (url && (url.length > URL_MAX || !isHttpUrl(url))) errors[field] = "Enter a full http:// or https:// link.";
    return url;
  };
  return { scriptUrl: read("scriptUrl"), recordUrl: read("recordUrl"), errors };
}

/**
 * Who may be picked, given facts loaded from the DB (pure). A person already
 * stored on this task stays allowed (the form shows the ineligible hint).
 * @param {{ videographers: string[], presenters: object[] }} people  from readProductionPeople
 * @param {{ eligibleVideographers: Set<string>, activeUserIds: Set<string>, activeExternalIds: Set<string>,
 *           storedVideographers: Set<string>, storedPresenterKeys: Set<string> }} facts
 * @returns {Record<string, string>} errors
 */
export function checkProductionPeople(people, facts) {
  const errors = {};
  const badV = people.videographers.find((id) => !facts.storedVideographers.has(id) && !facts.eligibleVideographers.has(id));
  if (badV) errors.videographers = "One of these people can't film production tasks in this project.";
  for (const p of people.presenters) {
    if (!p.id || facts.storedPresenterKeys.has(personKey(p))) continue; // new name / unchanged
    if (p.kind === "user" && !facts.activeUserIds.has(p.id)) {
      errors.presenters = "One of these people is no longer available. Choose someone else.";
      break;
    }
    if (p.kind === "external" && !facts.activeExternalIds.has(p.id)) {
      errors.presenters = "One of these external presenters is no longer available. Choose someone else.";
      break;
    }
  }
  return errors;
}

/** The task's main assignee: the first videographer, or null. */
export const mainAssignee = (videographers) => (Array.isArray(videographers) && videographers.length ? videographers[0] : null);

const idString = (v) => (v ? String(v) : "");

/**
 * Every Studio account involved in a task (deciding whose work it is): the
 * assignee, plus — Production — every videographer and account presenter.
 * @returns {string[]} unique user ids
 */
export function involvedUserIds(task) {
  const d = task?.details ?? {};
  const ids = [
    idString(task?.assignee),
    ...(d.videographers ?? []).map(idString),
    ...(d.presenters ?? []).filter((p) => p?.kind === "user").map((p) => idString(p.id)),
  ].filter(Boolean);
  return [...new Set(ids)];
}

/**
 * Cards' "+N": the OTHER accounts on a Production task beyond the assignee
 * (videographers and account presenters; externals don't count).
 */
export const extraPeopleCount = (task) => {
  if (task?.type !== "production") return 0;
  const assignee = idString(task.assignee);
  return involvedUserIds(task).filter((id) => id !== assignee).length;
};

/** "user:<id>" / "external:<id>" — a stable key per person entry. */
export const personKey = (p) => (typeof p === "object" && p ? `${p.kind}:${idString(p.id)}` : `user:${idString(p)}`);

const ROLES = [
  ["videographers", "Videographer"],
  ["presenters", "Presenter"],
];

/**
 * Who was added / removed per role between two details objects (keys from
 * personKey; order: as listed after / before). [] when nothing changed.
 * @returns {{ role: string, added: string[], removed: string[] }[]}
 */
export function peopleChanges(beforeDetails, afterDetails) {
  const out = [];
  for (const [field, role] of ROLES) {
    const b = (beforeDetails?.[field] ?? []).map(personKey);
    const a = (afterDetails?.[field] ?? []).map(personKey);
    const added = a.filter((k) => !b.includes(k));
    const removed = b.filter((k) => !a.includes(k));
    if (added.length || removed.length) out.push({ role, added, removed });
  }
  return out;
}

/** "Videographer: + Somchai, − Nida" (names already resolved). */
export function peopleLine({ role, added = [], removed = [] }) {
  const parts = [...added.map((n) => `+ ${n}`), ...removed.map((n) => `− ${n}`)];
  return `${role}: ${parts.join(", ")}`;
}
