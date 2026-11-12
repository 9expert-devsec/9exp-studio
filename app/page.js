import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import StudioLogo from "@/components/brand/StudioLogo";

// Temporary signed-in placeholder until the Figma app shell arrives.
// The static part prerenders; the session read streams in behind <Suspense>
// (required under cacheComponents).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-navy px-4 text-white">
      <StudioLogo size="lg" />
      <Suspense fallback={<p className="h-[5.5rem] text-sm text-white/50">Loading…</p>}>
        <SessionPanel />
      </Suspense>
    </main>
  );
}

async function SessionPanel() {
  const session = await auth();
  const user = session?.user;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-white/80">
        Signed in as <span className="font-semibold text-white">{user?.name}</span>{" "}
        ({user?.role})
      </p>
      <form action={signOutAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
