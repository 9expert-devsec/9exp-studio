"use client";

import { useSyncExternalStore } from "react";
import MagicRings from "@/components/effects/MagicRings";

// Desktop: rings centred on the viewport (approved; do not change).
//
// Mobile (< 640px): the React Bits mobile look — wide soft arcs above the card,
// glowing upward. MagicRings draws each ring as an arc whose brightness peaks along
// the rotation axis (both ends), so rotation 90 puts the arcs top and bottom. The
// ring centre is always the container centre, so the container is made 170dvh tall
// (centre at 85dvh) and the bottom arcs fall below the fold. The unit stays
// min(width, height) = screen width.

const BASE_PROPS = {
  color: "#fb923c",
  colorTwo: "#fdba74",
  motion: "pulse",
  ringCount: 4,
  speed: 1,
  lineThickness: 2,
  glow: 1,
  hoverScale: 1,
  clickBurst: false,
  hoverIntensity: 0.2,
  parallax: 0,
};

const DESKTOP = { ...BASE_PROPS, baseRadius: 0.35, radiusStep: 0.12 };
const MOBILE = {
  ...BASE_PROPS,
  rotation: 90,
  baseRadius: 1.25,
  radiusStep: 0.14,
  glow: 1.4,
  ringCount: 4,
};

const DESKTOP_WRAPPER = "fixed inset-0 z-0";
const MOBILE_WRAPPER = "pointer-events-none fixed left-0 top-0 z-0 h-[170dvh] w-full";

const QUERY = "(max-width: 639px)";

function subscribe(onChange) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
// Server render and hydration use the desktop set, so /login stays static.
const getServerSnapshot = () => false;

export default function LoginRings() {
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div className={isMobile ? MOBILE_WRAPPER : DESKTOP_WRAPPER}>
      <MagicRings {...(isMobile ? MOBILE : DESKTOP)} />
    </div>
  );
}
