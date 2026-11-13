// Seed the default roles into the live database. IDEMPOTENT.
//
// Usage:
//   npm run seed-roles
//   node --env-file=.env.local scripts/seed-roles.mjs
//
// Upserts by `key` with $setOnInsert only: an existing role is never modified,
// so names and descriptions edited in Team Management are kept.
// Plain Node script: no Next.js-only modules.

import mongoose from "mongoose";
import Role from "../models/Role.js";

const DEFAULT_ROLES = [
  { key: "superadmin", name: "Super Admin", isSystem: true },
  { key: "manager", name: "Manager", isSystem: false },
  { key: "editor", name: "Editor", isSystem: false },
  { key: "graphic", name: "Graphic", isSystem: false },
  { key: "publisher", name: "Publisher", isSystem: false },
  { key: "writer", name: "Writer", isSystem: false },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  if (!uri || !dbName) {
    console.error(
      "Error: MONGODB_URI and MONGODB_DB_NAME must be set (run with --env-file=.env.local)."
    );
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName });

  try {
    await Role.init(); // make sure the unique index on `key` exists

    const inserted = [];
    const existing = [];

    for (const role of DEFAULT_ROLES) {
      const now = new Date();
      const result = await Role.updateOne(
        { key: role.key },
        {
          $setOnInsert: {
            name: role.name,
            description: "",
            isSystem: role.isSystem,
            permissions: [],
            createdAt: now,
            updatedAt: now,
          },
        },
        // timestamps: false so an existing role's updatedAt is not touched either.
        { upsert: true, timestamps: false }
      );
      (result.upsertedCount > 0 ? inserted : existing).push(role.key);
    }

    console.log(`Inserted (${inserted.length}): ${inserted.join(", ") || "none"}`);
    console.log(`Already existed (${existing.length}): ${existing.join(", ") || "none"}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (err) => {
  console.error(`Error: ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
