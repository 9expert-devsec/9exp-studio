import mongoose from "mongoose";

// Role keys: lowercase letter first, then 1–31 of [a-z0-9_-]. Users store the key.
export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
export const ROLE_NAME_MAX = 60;
export const ROLE_DESCRIPTION_MAX = 300;

const RoleSchema = new mongoose.Schema(
  {
    // Immutable: users reference roles by key, so renaming it would orphan them.
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: ROLE_KEY_PATTERN,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, maxlength: ROLE_NAME_MAX },
    description: { type: String, trim: true, maxlength: ROLE_DESCRIPTION_MAX, default: "" },
    isSystem: { type: Boolean, default: false },
    // RESERVED: unused until the team confirms the permission set (role matrix).
    // Nothing reads or enforces it yet; Team Management is gated on "superadmin" only.
    permissions: { type: [String], default: [] },
  },
  { timestamps: true, collection: "roles" }
);

const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);

export default Role;
