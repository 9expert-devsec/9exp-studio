// Server-side validation for the project form (authoritative; the form mirrors it).
// Returns field-level errors keyed by field name.

import "server-only";
import mongoose from "mongoose";
import User from "@/models/User";
import {
  DEFAULT_PROJECT_ICON,
  PROJECT_DESCRIPTION_MAX,
  PROJECT_ICON_KEYS,
  PROJECT_MEMBERS_MAX,
  PROJECT_NAME_MAX,
  PROJECT_TYPE,
  CONTENT_DESCRIPTION_MAX,
  CONTENT_NAME_MAX,
  TASK_TITLE_MAX,
  isHttpUrl,
  parseDateOnly,
} from "./rules";
import { getTaskType, initialStatus, isTaskTypeEnabled } from "@/lib/tasks/types";

const str = (v) => (typeof v === "string" ? v : "");

/**
 * @param {FormData} formData
 * @param {{ ownerId: mongoose.Types.ObjectId, existingMembers?: mongoose.Types.ObjectId[] }} ctx
 *   ownerId: stripped from members. existingMembers (edit): may stay even if since
 *   deactivated; only NEWLY added members must be active.
 * @returns {Promise<{ values: object } | { errors: Record<string, string> }>}
 */
export async function parseProjectForm(formData, { ownerId, existingMembers = [] }) {
  const errors = {};

  const name = str(formData.get("name")).trim();
  if (!name) errors.name = "Project name is required.";
  else if (name.length > PROJECT_NAME_MAX) errors.name = `Use at most ${PROJECT_NAME_MAX} characters.`;

  const iconRaw = str(formData.get("icon"));
  const icon = PROJECT_ICON_KEYS.includes(iconRaw) ? iconRaw : DEFAULT_PROJECT_ICON;

  // Every project is a Campaign; any posted "type" is ignored.
  const type = PROJECT_TYPE;

  // Both dates optional. Blank → null; a non-blank value must be a real date; when
  // both are given, end >= start.
  const date = (field) => {
    const raw = str(formData.get(field)).trim();
    if (!raw) return null;
    const d = parseDateOnly(raw);
    if (!d) errors[field] = "Enter a valid date.";
    return d;
  };
  const startDate = date("startDate");
  const endDate = date("endDate");
  if (startDate && endDate && endDate < startDate) errors.endDate = "End date can't be before the start date.";

  const description = str(formData.get("description")).trim();
  if (description.length > PROJECT_DESCRIPTION_MAX) {
    errors.description = `Use at most ${PROJECT_DESCRIPTION_MAX} characters.`;
  }

  const briefLink = str(formData.get("briefLink")).trim();
  if (briefLink && !isHttpUrl(briefLink)) errors.briefLink = "Enter a full http:// or https:// link.";

  // Members: valid ids of ACTIVE accounts, deduped, owner stripped.
  const ownerStr = ownerId.toString();
  const ids = [...new Set(formData.getAll("members").map(str))].filter((id) => id && id !== ownerStr);
  let members = [];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    errors.members = "One of the selected members is not valid.";
  } else if (ids.length > PROJECT_MEMBERS_MAX) {
    errors.members = `A project can have at most ${PROJECT_MEMBERS_MAX} members.`;
  } else if (ids.length) {
    const found = await User.find({
      _id: { $in: ids },
      $or: [{ isActive: true }, { _id: { $in: existingMembers } }],
    })
      .select("_id")
      .lean();
    if (found.length !== ids.length) {
      errors.members = "Some selected members are no longer active. Remove them and try again.";
    }
    members = found.map((u) => u._id);
  }

  if (Object.keys(errors).length) return { errors };
  return { values: { name, icon, type, startDate, endDate, description, briefLink, members } };
}

/**
 * Content form (create/edit). Only name, description, brief link and due date are editable;
 * number, project, status and createdBy are set by the server.
 * @param {FormData} formData
 * @returns {{ values: { name: string, description: string, briefLink: string, dueDate: Date | null } } | { errors: Record<string, string> }}
 */
export function parseContentForm(formData) {
  const errors = {};

  const name = str(formData.get("name")).trim();
  if (!name) errors.name = "Content name is required.";
  else if (name.length > CONTENT_NAME_MAX) errors.name = `Use at most ${CONTENT_NAME_MAX} characters.`;

  const description = str(formData.get("description")).trim();
  if (description.length > CONTENT_DESCRIPTION_MAX) {
    errors.description = `Use at most ${CONTENT_DESCRIPTION_MAX} characters.`;
  }

  const briefLink = str(formData.get("briefLink")).trim();
  if (briefLink && !isHttpUrl(briefLink)) errors.briefLink = "Enter a full http:// or https:// link.";

  // Optional due date: blank → null; otherwise a real YYYY-MM-DD.
  const dueRaw = str(formData.get("dueDate")).trim();
  const dueDate = dueRaw ? parseDateOnly(dueRaw) : null;
  if (dueRaw && !dueDate) errors.dueDate = "Enter a valid date.";

  if (Object.keys(errors).length) return { errors };
  return { values: { name, description, briefLink, dueDate } };
}

/**
 * Create Task, Step 1: title + type. The type must exist and be enabled (a crafted
 * "production" is rejected here); the caller then checks canCreateTask() for the
 * role. Status, number, assetStatus and createdBy are set by the server.
 * @returns {{ values: { title: string, type: string } } | { errors: Record<string, string> }}
 */
export function parseTaskForm(formData) {
  const errors = {};

  const title = str(formData.get("title")).trim();
  if (!title) errors.title = "Task name is required.";
  else if (title.length > TASK_TITLE_MAX) errors.title = `Use at most ${TASK_TITLE_MAX} characters.`;

  const type = str(formData.get("type"));
  if (!type) errors.type = "Choose a task type.";
  else if (!getTaskType(type)) errors.type = "Choose a task type.";
  else if (!isTaskTypeEnabled(type) || !initialStatus(type)) errors.type = "This task type isn't available yet.";

  if (Object.keys(errors).length) return { errors };
  return { values: { title, type } };
}
