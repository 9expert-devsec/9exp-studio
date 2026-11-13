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
  },
  { timestamps: true, collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export default User;
