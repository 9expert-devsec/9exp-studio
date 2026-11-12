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
          clickBurst={true}
          baseRadius={0.18}
          radiusStep={0.06}
          hoverIntensity={0.2}
          parallax={0}
        />
      </div>

      <main className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10">
        <LoginForm />
      </main>
    </div>
  );
}
