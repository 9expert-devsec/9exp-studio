"use client";

import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

// Copies the project URL. No app-wide toast exists, so it shows an inline "Copied".
export default function ShareButton({ href }) {
  const [state, setState] = useState("idle"); // idle | copied | failed

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <button type="button" onClick={share} className={buttonClass("secondary")}>
      {state === "copied" ? (
        <Check className="size-4 text-success" aria-hidden="true" />
      ) : (
        <Share2 className="size-4" aria-hidden="true" />
      )}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Share"}
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Project link copied" : ""}
      </span>
    </button>
  );
}
