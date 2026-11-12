import MagicRings from "@/components/effects/MagicRings";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign in · 9Expert Studio",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-dvh flex-1 bg-[#0D0D12]">
      <div className="fixed inset-0 z-0">
        <MagicRings
          color="#fb923c"
          colorTwo="#fdba74"
          motion="pulse"
          ringCount={4}
          speed={1}
          lineThickness={2}
          glow={1}
          hoverScale={1}
          clickBurst={false}
          baseRadius={0.35}
          radiusStep={0.06}
          hoverIntensity={0.2}
          parallax={0}
        />
      </div>

      <main className="relative z-10 flex min-h-dvh items-center justify-center py-10">
        {/* Opaque card on top of the full-viewport rings. */}
        <div className="mx-4 w-full max-w-[640px] rounded-3xl border border-white/10 bg-[#1e1e1e] px-6 py-8 shadow-2xl shadow-black/50 sm:px-12 sm:py-12">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
