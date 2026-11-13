import { Suspense } from "react";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { formatDate, formatDateTime, initialsOf } from "@/lib/format";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata = {
  title: "Account · 9Expert Studio",
};

export default function AccountPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader section="Account" title="Account" />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card as="section" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="mb-6 text-lg text-fg">
            Profile
          </h2>
          <Suspense fallback={<ProfileSkeleton />}>
            <Profile />
          </Suspense>
        </Card>

        <Card as="section" aria-labelledby="password-heading">
          <h2 id="password-heading" className="mb-6 text-lg text-fg">
            Change password
          </h2>
          <ChangePasswordForm />
        </Card>
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
      <p className="text-sm text-fg-muted">
        Your account could not be found. Please sign in again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-[18px] bg-brand-500 text-xl font-semibold text-navy">
          {initialsOf(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-fg">
            {user.name}
          </p>
          <p className="truncate text-sm text-fg-muted">{user.email}</p>
          <span className="mt-2 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium capitalize text-accent-fg">
            {user.role}
          </span>
        </div>
      </div>

      <dl className="grid gap-4 border-t border-line-subtle pt-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-fg-muted">Last sign-in</dt>
          <dd className="mt-1 font-medium text-fg">
            {formatDateTime(user.lastLoginAt)}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted">Member since</dt>
          <dd className="mt-1 font-medium text-fg">
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
        <span className="size-16 rounded-full bg-track" />
        <div className="flex flex-1 flex-col gap-2">
          <span className="h-4 w-40 rounded bg-track" />
          <span className="h-3 w-56 rounded bg-track" />
        </div>
      </div>
      <span className="h-12 rounded bg-track" />
    </div>
  );
}
