"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { initialsOf } from "@/lib/format";

// Account pill + dropdown. `user` and `signOutAction` come from the server (UserMenuSlot).
// Figma pill: 34px tall, radius 18, `control` surface, 24px avatar (radius 10,
// navy initials on brand-500), name + role stacked, 13px chevron.
// DEVIATION: Figma's 10px/8px text is raised to 13px/11px for legibility.
export default function UserMenu({ user, signOutAction }) {
  const pathname = usePathname();
  // Open "for a path": navigating closes it automatically.
  const [openPath, setOpenPath] = useState(null);
  const open = openPath === pathname;
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpenPath(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-fg hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-brand-500";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenPath(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${user.name}`}
        className="relative flex h-[34px] items-center gap-2 rounded-[18px] border border-control-line bg-control p-1 pr-2 text-left transition-colors after:absolute after:-inset-y-[5px] after:inset-x-0 after:content-[''] hover:bg-card-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-[10px] bg-brand-500 text-[10px] font-semibold text-navy"
        >
          {initialsOf(user.name)}
        </span>
        <span className="hidden min-w-0 max-w-36 flex-col sm:flex">
          <span className="truncate text-[13px] font-semibold leading-[15px] text-fg">{user.name}</span>
          <span className="truncate text-[11px] leading-[13px] text-fg-muted">{user.roleName}</span>
        </span>
        <ChevronDown
          className={`size-[13px] shrink-0 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-[18px] border border-line bg-card p-2 shadow-xl"
        >
          <div className="border-b border-line-subtle px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
            <span className="mt-2 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-fg">
              {user.roleName}
            </span>
          </div>
          <div className="pt-2">
            <Link href="/account" className={itemClass}>
              <Settings className="size-4" aria-hidden="true" />
              Account settings
            </Link>
            <form action={signOutAction}>
              <button type="submit" className={itemClass}>
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
