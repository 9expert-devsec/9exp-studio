// Project detail header card (shared by every /projects/[id]/(tabs) route via the
// layout). No hooks: server-rendered; the ⋯ menu and Share are client islands.
//
// Tint: the project's icon colour, passed INLINE as the `--project-tint` custom
// property and read by the literal `.project-tint` class (app/globals.css):
// a soft diagonal wash + tinted border, in both themes. No progress section (the
// Overview stat tiles carry the numbers).
// Round 55: classes come from ./projectTopStyles (shared with ProjectTopSkeleton);
// the name is clamped to one line (full name in `title`), so the card height is
// fixed and the first-entry skeleton matches it exactly.

import Link from "next/link";
import { CalendarDays, Pencil } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { projectIcon } from "@/lib/projects/icons";
import ProjectMenu from "./ProjectMenu";
import ShareButton from "./ShareButton";
import { Chip, ProjectIconTile, StatusChip } from "./ProjectBits";
import {
  HEADER_ACTIONS,
  HEADER_CARD_PAD,
  HEADER_LABEL,
  HEADER_LEFT,
  HEADER_META,
  HEADER_NAME,
  HEADER_ROW,
  HEADER_TEXT,
} from "./projectTopStyles";

export default function ProjectHeaderCard({ project }) {
  const cancelled = project.status === "cancelled";

  return (
    <Card
      padded={false}
      style={{ "--project-tint": projectIcon(project.icon).color }}
      className={`project-tint ${HEADER_CARD_PAD} ${cancelled ? "opacity-80" : ""}`}
    >
      <div className={HEADER_ROW}>
        <div className={HEADER_LEFT}>
          <ProjectIconTile icon={project.icon} size="lg" />
          <div className={HEADER_TEXT}>
            <p className={HEADER_LABEL}>Project name</p>
            <h1 className={HEADER_NAME} title={project.name}>
              {project.name}
            </h1>
            <div className={HEADER_META}>
              <Chip>{project.typeLabel}</Chip>
              <StatusChip status={project.status} />
              {project.datesLabel && (
                <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {project.datesLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={HEADER_ACTIONS}>
          <ShareButton href={project.href} />
          {project.canEdit && (
            <Link href={`${project.href}/edit`} className={buttonClass("primary")}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit project
            </Link>
          )}
          {(project.canCancel || project.canReopen) && (
            <ProjectMenu project={project} showOpen={false} showPin={false} showCopy={false} showEdit={false} />
          )}
        </div>
      </div>
    </Card>
  );
}
