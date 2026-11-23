"use client";

// Timeline view preferences per user + device + project: scale and collapsed
// content groups (filters are NOT remembered). localStorage, every access wrapped
// in try/catch; an in-memory copy keeps the choice for this tab when storage is
// blocked or full. Read through useSyncExternalStore (server snapshot = null →
// defaults), so the first client render matches the server HTML.

import { useSyncExternalStore } from "react";
import { validScale } from "@/lib/timeline/layout";

const listeners = new Set();
const memory = new Map();

function read(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // blocked / full: the in-memory copy still applies for this tab
  }
  for (const l of listeners) l();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parse(raw) {
  let v = null;
  try {
    v = raw ? JSON.parse(raw) : null;
  } catch {
    v = null;
  }
  return {
    scale: validScale(v?.scale),
    collapsed: Array.isArray(v?.collapsed) ? v.collapsed.filter((x) => typeof x === "string") : [],
  };
}

/** [prefs, update(patch)] for one project and viewer. */
export function useTimelinePrefs(viewerId, projectId) {
  const key = `studio.timeline.${viewerId}.${projectId}`;
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const update = (patch) => write(key, JSON.stringify({ ...parse(read(key)), ...patch }));
  return [parse(raw), update];
}
