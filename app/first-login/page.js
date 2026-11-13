import AuthScreen from "@/components/auth/AuthScreen";
import FirstLoginForm from "./FirstLoginForm";

export const metadata = {
  title: "Set your new password · 9Expert Studio",
};

export const viewport = {
  viewportFit: "cover",
};

// Outside the (app) shell. proxy.js (auth.config.js `authorized`) only lets signed-in
// users who still have mustChangePassword in their session reach this page; the
// server action re-checks the flag in the DB.
export default function FirstLoginPage() {
  return (
    <AuthScreen>
      <FirstLoginForm />
    </AuthScreen>
  );
}
