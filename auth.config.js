// Edge-safe Auth.js config: no database or Node-only imports here.
// Shared by `auth.js` (full config) and `proxy.js` (route protection).

const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days
  providers: [], // Credentials provider is added in auth.js
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isSignedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";

      if (isLoginPage) {
        if (isSignedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      // Every other route requires a session; false redirects to pages.signIn.
      return isSignedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};

export default authConfig;
