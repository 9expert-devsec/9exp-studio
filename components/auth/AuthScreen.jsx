import LoginRings from "@/app/login/LoginRings";

// Signed-out / pre-app screen shared by /login and /first-login: the LoginRings
// background and the opaque #1e1e1e card (moved here unchanged from app/login/page.js).
// Pages that use it should also export `viewport = { viewportFit: "cover" }`.
export default function AuthScreen({ children }) {
  return (
    <div className="relative min-h-dvh flex-1 bg-[#0D0D12]">
      {/* Renders its own fixed z-0 wrapper (geometry switches with the breakpoint). */}
      <LoginRings />

      {/* min-h-dvh (not 100vh) and no overflow-hidden: the page scrolls if the card is
          taller than the viewport. env() insets are 0 on desktop, so ≥640px is unchanged. */}
      <main className="relative z-10 flex min-h-dvh items-center justify-center pt-[calc(2.5rem+env(safe-area-inset-top))] pr-[env(safe-area-inset-right)] pb-[calc(2.5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)]">
        {/* Opaque card on top of the full-viewport rings. */}
        <div className="mx-4 w-full max-w-[448px] rounded-3xl border border-white/10 bg-[#1e1e1e] px-6 py-8 shadow-2xl shadow-black/50 sm:px-10 sm:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
