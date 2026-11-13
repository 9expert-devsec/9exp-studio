"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import IconButton from "@/components/ui/IconButton";

// Theme = `dark` class on <html> (set before paint by the script in app/layout.js).
// The stored choice lives in localStorage under "theme"; no choice = system preference.
// DEVIATION: not in the Figma header; added as a 4th round control (light/dark is required).

const EVENT = "themechange";

function subscribe(onChange) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage blocked (private mode etc.): theme still applies for this page view.
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      onClick={toggle}
      label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
    />
  );
}
