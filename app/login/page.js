import AuthScreen from "@/components/auth/AuthScreen";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign in · 9Expert Studio",
};

// Lets the page extend under notches; safe-area padding below keeps the card clear.
export const viewport = {
  viewportFit: "cover",
};

export default function LoginPage() {
  return (
    <AuthScreen>
      <LoginForm />
    </AuthScreen>
  );
}
