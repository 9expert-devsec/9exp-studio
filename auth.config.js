// Edge-safe Auth.js config: no database or Node-only imports here.
// Shared by `auth.js` (full config) and `proxy.js` (route protection).

const LOGIN = "/login";
const FIRST_LOGIN = "/first-login";

const authConfig = {
  trustHost: true,
  pages: { signIn: LOGIN },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days
  providers: [], // Credentials provider is added in auth.js
  callbacks: {
    // Routing gate (runs in proxy.js for every matched path):
    // - signed out: only /login; anything else (incl. /first-login) → /login
    // - mustChangePassword: everything except /first-login → /first-login
    // - no flag: /first-login → /
    // - /login while signed in → /first-login or / by the flag
    // The JWT flag is a convenience only: server actions also re-check the DB.
    authorized({ auth, request: { nextUrl } }) {
      const isSignedIn = !!auth?.user;
      const mustChange = !!auth?.user?.mustChangePassword;
      const path = nextUrl.pathname;
      const home = mustChange ? FIRST_LOGIN : "/";

      if (path === LOGIN) {
        if (isSignedIn) return Response.redirect(new URL(home, nextUrl));
        return true;
      }

      // Every other route requires a session; false redirects to pages.signIn.
      if (!isSignedIn) return false;

      if (mustChange && path !== FIRST_LOGIN) {
        return Response.redirect(new URL(FIRST_LOGIN, nextUrl));
      }
      if (!mustChange && path === FIRST_LOGIN) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
    // Claims are copied ONLY at sign-in (`user` comes from authorize()). Updates via
    // the session endpoint (trigger === "update") are deliberately ignored: a client
    // can send arbitrary data there, so it must never change role or the flag.
    // /first-login clears the flag by signing in again, which mints a fresh token.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = !!user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.mustChangePassword = !!token.mustChangePassword;
      }
      return session;
    },
  },
};

export default authConfig;
