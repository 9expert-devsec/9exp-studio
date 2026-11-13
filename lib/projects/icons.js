// Project icon registry: the ONE place icon keys map to a Lucide component, colour
// and label. Colours are runtime hex values → apply with inline `style`, never a
// Tailwind class (interpolated classes produce no CSS).

import {
  AudioLines,
  CalendarDays,
  Clapperboard,
  Film,
  Folder,
  GraduationCap,
  Megaphone,
  MonitorPlay,
  Palette,
  Presentation,
  Video,
} from "lucide-react";
import { DEFAULT_PROJECT_ICON, PROJECT_ICON_KEYS } from "./rules";

export const PROJECT_ICONS = {
  film: { component: Film, color: "#38BDF8", label: "Film / Video Editing" },
  clapperboard: { component: Clapperboard, color: "#A78BFA", label: "Video Production" },
  "calendar-days": { component: CalendarDays, color: "#FF8A3D", label: "Event" },
  folder: { component: Folder, color: "#94A3B8", label: "Default / General" },
  presentation: { component: Presentation, color: "#FBBF24", label: "Presentation / Seminar" },
  "audio-lines": { component: AudioLines, color: "#2DD4BF", label: "Audio Production" },
  megaphone: { component: Megaphone, color: "#FB7185", label: "Marketing / Promotion" },
  palette: { component: Palette, color: "#C084FC", label: "Graphic Design" },
  "graduation-cap": { component: GraduationCap, color: "#60A5FA", label: "Education / E-Learning" },
  "monitor-play": { component: MonitorPlay, color: "#4ADE80", label: "Online Course / Video Lesson" },
  video: { component: Video, color: "#22D3EE", label: "Video Recording" },
};

/** In registry order (matches PROJECT_ICON_KEYS). */
export const PROJECT_ICON_LIST = PROJECT_ICON_KEYS.map((key) => ({ key, ...PROJECT_ICONS[key] }));

/** Unknown key → folder. */
export function projectIcon(key) {
  return PROJECT_ICONS[key] ?? PROJECT_ICONS[DEFAULT_PROJECT_ICON];
}
