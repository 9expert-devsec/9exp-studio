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
  PROJECT_TYPES,
  isHttpUrl,
  parseDateOnly,
} from "./rules";

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

  const type = str(formData.get("type"));
  if (!PROJECT_TYPES.includes(type)) errors.type = "Choose Ongoing or Campaign.";

  const startDate = parseDateOnly(str(formData.get("startDate")));
  if (!startDate) errors.startDate = "Pick a start date.";

  // Campaign: end date required and >= start. Ongoing: always cleared.
  let endDate = null;
  if (type === "campaign") {
    endDate = parseDateOnly(str(formData.get("endDate")));
    if (!endDate) errors.endDate = "Pick an end date for a campaign.";
    else if (startDate && endDate < startDate) errors.endDate = "End date can't be before the start date.";
  }

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
