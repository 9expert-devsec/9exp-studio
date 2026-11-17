// Daily MSDB mirror sync (vercel.json `crons`, 20:00 UTC = 03:00 Bangkok).
// Requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends it when
// CRON_SECRET is set). Missing/wrong header, or CRON_SECRET unset → 401.
// proxy.js skips /api/cron (no session here); this check is the only gate.

import { createHash, timingSafeEqual } from "node:crypto";
import { syncMsdbRefs } from "@/lib/msdbSync";

export const maxDuration = 60;

const digest = (s) => createHash("sha256").update(s, "utf8").digest();

/** Constant-time compare (hashing first makes both sides the same length). */
function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET(request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncMsdbRefs({ reason: "cron" });
  if (result.skipped) return Response.json({ ok: true, skipped: true });
  return Response.json({ ok: result.ok, counts: result.counts, error: result.error }, { status: result.ok ? 200 : 502 });
}
