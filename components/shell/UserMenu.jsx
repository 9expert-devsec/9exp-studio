"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { initialsOf } from "@/lib/format";

// Avatar + dropdown. `user` and `signOutAction` come from the server (UserMenuSlot).
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
    "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-200 dark:hover:bg-white/5";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenPath(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${user.name}`}
        className="flex min-h-11 items-center gap-1.5 rounded-full p-1 pr-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-white/5"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
          {initialsOf(user.name)}
        </span>
        <ChevronDown
          className={`size-4 text-slate-500 transition-transform dark:text-slate-400 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-surface-dark"
        >
          <div className="border-b border-slate-200 px-3 pb-3 pt-2 dark:border-white/10">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            <span className="mt-2 inline-block rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-medium capitalize text-brand-700 dark:text-brand-300">
              {user.role}
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
