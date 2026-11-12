import LoginForm from "./LoginForm";
import LoginRings from "./LoginRings";

export const metadata = {
  title: "Sign in · 9Expert Studio",
};

// Lets the page extend under notches; safe-area padding below keeps the card clear.
export const viewport = {
  viewportFit: "cover",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-dvh flex-1 bg-[#0D0D12]">
      {/* Renders its own fixed z-0 wrapper (geometry switches with the breakpoint). */}
      <LoginRings />

      {/* min-h-dvh (not 100vh) and no overflow-hidden: the page scrolls if the card is
          taller than the viewport. env() insets are 0 on desktop, so ≥640px is unchanged. */}
      <main className="relative z-10 flex min-h-dvh items-center justify-center pt-[calc(2.5rem+env(safe-area-inset-top))] pr-[env(safe-area-inset-right)] pb-[calc(2.5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)]">
        {/* Opaque card on top of the full-viewport rings. */}
        <div className="mx-4 w-full max-w-[448px] rounded-3xl border border-white/10 bg-[#1e1e1e] px-6 py-8 shadow-2xl shadow-black/50 sm:px-10 sm:py-12">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
