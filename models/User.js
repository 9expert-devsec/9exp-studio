import mongoose from "mongoose";

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
    // A Role `key` (models/Role.js). No enum: roles live in the `roles` collection,
    // and the server actions / scripts check the key exists before writing it.
    role: { type: String, required: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date },
    // Set on admin-provisioned passwords (create, reset, create-user script); cleared
    // when the person sets their own. Missing on older docs = false (no backfill).
    mustChangePassword: { type: Boolean, default: false },
    // Optional profile picture on Cloudinary (9exp-studio/avatars/). See lib/avatar.js.
    avatar: { url: String, publicId: String, updatedAt: Date },
  },
  { timestamps: true, collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export default User;
