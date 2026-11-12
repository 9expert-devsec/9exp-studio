import { Suspense } from "react";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { formatDate, formatDateTime, initialsOf } from "@/lib/format";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata = {
  title: "Account · 9Expert Studio",
};

const card =
  "rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-surface-dark sm:p-8";

export default function AccountPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <h1 className="text-2xl text-slate-900 dark:text-white sm:text-3xl">Account</h1>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className={card} aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="mb-6 text-lg text-slate-900 dark:text-white">
            Profile
          </h2>
          <Suspense fallback={<ProfileSkeleton />}>
            <Profile />
          </Suspense>
        </section>

        <section className={card} aria-labelledby="password-heading">
          <h2 id="password-heading" className="mb-6 text-lg text-slate-900 dark:text-white">
            Change password
          </h2>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}

// Reads the user from MongoDB by session id (not from the JWT) so values are current.
async function Profile() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !mongoose.isValidObjectId(userId)) redirect("/login");

  await dbConnect();
  const user = await User.findById(userId)
    .select("name email role lastLoginAt createdAt")
    .lean();
  if (!user) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Your account could not be found. Please sign in again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xl font-semibold text-white">
          {initialsOf(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-900 dark:text-white">
            {user.name}
          </p>
          <p className="truncate text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
          <span className="mt-2 inline-block rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-medium capitalize text-brand-700 dark:text-brand-300">
            {user.role}
          </span>
        </div>
      </div>

      <dl className="grid gap-4 border-t border-slate-200 pt-6 text-sm dark:border-white/10 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Last sign-in</dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-white">
            {formatDateTime(user.lastLoginAt)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Member since</dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-white">
            {formatDate(user.createdAt)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <div className="flex items-center gap-4">
        <span className="size-16 rounded-full bg-slate-200 dark:bg-white/10" />
        <div className="flex flex-1 flex-col gap-2">
          <span className="h-4 w-40 rounded bg-slate-200 dark:bg-white/10" />
          <span className="h-3 w-56 rounded bg-slate-200 dark:bg-white/10" />
        </div>
      </div>
      <span className="h-12 rounded bg-slate-200 dark:bg-white/10" />
    </div>
  );
}
