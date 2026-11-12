import mongoose from "mongoose";

// NOTE: Provisional role set, taken from the flowchart.
// The final role set is still undecided — revisit before building permissions.
export const USER_ROLES = [
  "superadmin",
  "manager",
  "editor",
  "graphic",
  "publisher",
  "writer",
];

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "editor" },
    isActive: { type: Boolean, default: true },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true, collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export default User;
