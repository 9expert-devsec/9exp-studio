// Create an admin-provisioned user in the live database.
//
// Usage:
//   node --env-file=.env.local scripts/create-user.mjs --email you@9expert.co.th --name "Name" --role superadmin
//   npm run create-user -- --email you@9expert.co.th --name "Name" --role superadmin
//
// Plain Node script: no Next.js-only modules.

import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User, { USER_ROLES } from "../models/User.js";

const USAGE = `Usage:
  npm run create-user -- --email <email> --name "<name>" --role <role>

  Roles: ${USER_ROLES.join(" | ")}

Example:
  npm run create-user -- --email you@9expert.co.th --name "Name" --role superadmin`;

function fail(message) {
  console.error(`Error: ${message}\n\n${USAGE}`);
  process.exit(1);
}

function generatePassword() {
  // 18 random bytes -> 24 URL-safe characters (~144 bits of entropy).
  return randomBytes(18).toString("base64url");
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        email: { type: "string" },
        name: { type: "string" },
        role: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
    }));
  } catch (err) {
    fail(err.message);
  }

  if (values.help || (!values.email && !values.name && !values.role)) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  const role = values.role?.trim();

  if (!email) fail("--email is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`"${email}" is not a valid email.`);
  if (!name) fail("--name is required.");
  if (!role) fail("--role is required.");
  if (!USER_ROLES.includes(role)) fail(`"${role}" is not a valid role.`);

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  if (!uri || !dbName) {
    fail("MONGODB_URI and MONGODB_DB_NAME must be set (run with --env-file=.env.local).");
  }

  await mongoose.connect(uri, { dbName });

  try {
    if (await User.exists({ email })) {
      console.error(`Error: a user with email ${email} already exists. Nothing was changed.`);
      process.exitCode = 1;
      return;
    }

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({ email, name, role, passwordHash });

    console.log(`Created ${role} user: ${name} <${email}>`);
    console.log("");
    console.log(`Temporary password (shown ONCE): ${password}`);
    console.log("Store it somewhere safe and change it after first sign-in.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (err) => {
  console.error(`Error: ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
