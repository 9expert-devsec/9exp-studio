// Route protection (Next.js 16 `proxy` convention, formerly `middleware`).
// Imports ONLY the DB-free auth config so Mongoose never enters this bundle.
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Skip Auth.js endpoints, cron routes (they check CRON_SECRET themselves), Next
  // internals, the app icon, brand assets and any static file.
  matcher: [
    "/((?!api/auth|api/cron/|_next/static|_next/image|icon.png|brand/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|css|js|map|woff2?)$).*)",
  ],
};
