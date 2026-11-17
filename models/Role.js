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
    // Role permissions (checked only by lib/permissions.js). Rule for both settings:
    // NOT configured = unrestricted; once saved (even empty) it restricts. Superadmin
    // always passes.
    //
    // Task types this role works on (lib/tasks/types.js keys). Absent/null = not
    // configured. `default: undefined` so new roles don't get [] (= restricted).
    taskTypes: { type: [String], default: undefined },
    // Generic permission keys (review_content, review_video, …). Legacy roles were
    // seeded with permissions: [] before anything used it, so an array alone does
    // NOT mean "configured": permissionsConfiguredAt is set when the Roles form
    // saves it, and cleared (with the array) when it is set back to unconfigured.
    permissions: { type: [String], default: undefined },
    permissionsConfiguredAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "roles" }
);

const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);

export default Role;
