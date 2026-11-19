import { Suspense } from "react";
import AppShell from "@/components/shell/AppShell";
import { Toaster } from "@/components/ui/Toast";
import { TeamNavItem, UserMenuSkeleton, UserMenuSlot } from "@/components/shell/SessionSlots";

// Shell for every signed-in route. proxy.js already requires a session for
// everything except /login, so all routes in this group are protected.
export default function AppLayout({ children }) {
  return (
    <AppShell
      teamSlot={
        <Suspense fallback={null}>
          <TeamNavItem />
        </Suspense>
      }
      userMenuSlot={
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenuSlot />
        </Suspense>
      }
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
