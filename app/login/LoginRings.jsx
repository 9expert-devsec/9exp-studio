"use client";

import { useSyncExternalStore } from "react";
import MagicRings from "@/components/effects/MagicRings";

// MagicRings sizes rings from min(width, height). On a portrait phone that is the
// width, so the desktop radii end up hidden behind the card. Narrow viewports get
// larger radii so the rings show as arcs above and below the card.

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
const MOBILE = { ...BASE_PROPS, baseRadius: 0.55, radiusStep: 0.18 };

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
  return <MagicRings {...(isMobile ? MOBILE : DESKTOP)} />;
}
