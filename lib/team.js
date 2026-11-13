// Team Management data-access layer (server only).
//
// NOT a "use server" module, so nothing here is a POST endpoint. Pages and the
// server actions in app/(app)/team/** import these helpers.
//
// Authorization: the caller's session only identifies them. Their role and
// active status are re-read from MongoDB on every call, so a stale JWT role is
// never trusted for Team Management.
//
// KNOWN LIMITATIONS (sessions are JWTs, checked at the edge with no DB lookup):
// - A role change or deactivation reaches the affected user's own session only at
//   their next sign-in, or when their JWT expires (7 days). Team Management
//   itself is not affected: it re-reads the caller's role from the DB.
// - Deactivation blocks NEW sign-ins immediately (auth.js `authorize` checks isActive).

import mongoose from "mongoose";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import Role from "@/models/Role";
import User from "@/models/User";

export const SUPERADMIN = "superadmin";

/**
 * The signed-in caller as a fresh DB doc, or null unless they are an active superadmin.
 * @returns {Promise<{ _id: mongoose.Types.ObjectId, name: string, role: string } | null>}
 */
export async function getSuperadmin() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !mongoose.isValidObjectId(userId)) return null;

  await dbConnect();
  const me = await User.findById(userId).select("name role isActive").lean();
  if (!me || !me.isActive || me.role !== SUPERADMIN) return null;
  return me;
}

/** Roles with the number of accounts using each key, for /team/roles. */
export async function loadRolesView() {
  const [roles, counts] = await Promise.all([
    Role.find().sort({ isSystem: -1, name: 1 }).lean(),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
  ]);
  const countByKey = new Map(counts.map((c) => [c._id, c.count]));

  return roles.map((r) => ({
    id: r._id.toString(),
    key: r.key,
    name: r.name,
    description: r.description ?? "",
    isSystem: !!r.isSystem,
    accountCount: countByKey.get(r.key) ?? 0,
  }));
}

/** Accounts plus the role options, for /team/accounts. Never selects passwordHash. */
export async function loadAccountsView() {
  const [users, roles] = await Promise.all([
    User.find()
      .select("name email role isActive lockedUntil lastLoginAt createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    Role.find().select("key name").sort({ isSystem: -1, name: 1 }).lean(),
  ]);

  const roleName = new Map(roles.map((r) => [r.key, r.name]));
  const now = new Date();

  const accounts = users.map((u) => {
    const locked = !!u.lockedUntil && u.lockedUntil > now;
    return {
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      roleKey: u.role,
      roleName: roleName.get(u.role) ?? u.role,
      roleKnown: roleName.has(u.role),
      isActive: !!u.isActive,
      locked,
      status: !u.isActive ? "inactive" : locked ? "locked" : "active",
      lastLoginLabel: formatDateTime(u.lastLoginAt),
      createdLabel: formatDate(u.createdAt),
    };
  });

  return {
    accounts,
    roles: roles.map((r) => ({ key: r.key, name: r.name })),
  };
}
