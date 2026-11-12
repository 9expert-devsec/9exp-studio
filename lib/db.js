import mongoose from "mongoose";

/**
 * Cached Mongoose connection.
 *
 * The connection (and the in-flight connect promise) is stored on `global`
 * so that hot reloads in development and warm serverless invocations reuse
 * a single connection instead of opening a new one on every import.
 */
let cached = global._mongoose;

if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local (see .env.example)."
    );
  }
  if (!dbName) {
    throw new Error(
      "MONGODB_DB_NAME is not set. Add it to .env.local (see .env.example)."
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { dbName, bufferCommands: false })
      .then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
