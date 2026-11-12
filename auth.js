import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/auth.config";
import dbConnect from "@/lib/db";
import User from "@/models/User";

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

async function recordFailedLogin(userId) {
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { failedLoginCount: 1 } },
    { returnDocument: "after" }
  );
  if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
          failedLoginCount: 0,
        },
      }
    );
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Every failure path returns null so callers can't tell whether the email exists.
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        await dbConnect();

        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user) return null;
        if (!user.isActive) return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await recordFailedLogin(user._id);
          return null;
        }

        await User.updateOne(
          { _id: user._id },
          {
            $set: { failedLoginCount: 0, lastLoginAt: new Date() },
            $unset: { lockedUntil: 1 },
          }
        );

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
