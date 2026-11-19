"use client";

// Shared Platform + Work Type pair (Graphic "Work Type", Post "Post Type" — the
// same Work Type list, round 27). Renders the two fields as siblings so the
// parent decides the grid. Work types are those linked to the chosen platform
// (active; the stored one stays listed); disabled until a platform is picked;
// changing the platform clears an incompatible work type. Server rule:
// lib/tasks/details.js parsePlatformWorkType.

import Combobox from "@/components/ui/Combobox";
import { Field } from "@/components/tasks/DetailBlocks";
import PlatformIcon from "@/components/tasks/PlatformIcon";
import { input } from "@/components/projects/ProjectForm";

const PlatformRow = ({ o }) => (
  <span className="flex min-w-0 items-center gap-2">
    <PlatformIcon icon={o.icon} />
    <span className="truncate">{o.label}</span>
  </span>
);

/**
 * @param {{ idPrefix: string, workTypeTitle?: string, values: { platform: string, workType: string },
 *           setField: (field: string, value: unknown) => void, errors: Record<string, string>,
 *           options: { platform?: object[], work_type?: object[] } }} props
 */
export default function PlatformWorkTypeFields({ idPrefix, workTypeTitle = "Work Type", values, setField, errors, options }) {
  const platforms = options.platform ?? [];
  const workTypes = options.work_type ?? [];
  const selectedPlatform = platforms.find((o) => o.id === values.platform) ?? null;
  const platformChoices = platforms.filter((o) => o.active || o.id === values.platform);

  const workTypesFor = (pid) => workTypes.filter((w) => (w.platforms ?? []).includes(pid) && (w.active || w.id === values.workType));
  const workTypeChoices = values.platform ? workTypesFor(values.platform) : [];
  const selectedWorkType = workTypeChoices.find((w) => w.id === values.workType) ?? null;
  const noun = workTypeTitle.toLowerCase();

  const choosePlatform = (o) => {
    const pid = o?.id ?? "";
    setField("platform", pid);
    if (values.workType && !workTypesFor(pid).some((w) => w.id === values.workType)) setField("workType", "");
  };

  const pId = `${idPrefix}-platform`;
  const wId = `${idPrefix}-work-type`;
  return (
    <>
      <Field id={pId} title="Platform" required error={errors.platform}>
        <Combobox
          id={pId}
          value={selectedPlatform}
          onChange={choosePlatform}
          options={platformChoices}
          renderOption={(o) => <PlatformRow o={o} />}
          renderValue={(o) => <PlatformRow o={o} />}
          labelledBy={`${pId}-label`}
          placeholder="Choose"
          emptyText={platforms.length ? "No matches" : "No platforms yet — ask an admin to add some."}
          listLabel="Platforms"
          invalid={!!errors.platform}
          describedBy={`${pId}-error`}
        />
      </Field>
      <Field
        id={wId}
        title={workTypeTitle}
        required
        error={errors.workType}
        hint={values.platform && workTypeChoices.length === 0 ? `No ${noun}s linked to this platform yet.` : undefined}
      >
        {values.platform && workTypeChoices.length > 0 ? (
          <Combobox
            id={wId}
            value={selectedWorkType}
            onChange={(o) => setField("workType", o?.id ?? "")}
            options={workTypeChoices}
            renderValue={(o) => <span className="truncate">{o.label}</span>}
            labelledBy={`${wId}-label`}
            placeholder="Choose"
            listLabel={`${workTypeTitle}s`}
            invalid={!!errors.workType}
            describedBy={`${wId}-error`}
          />
        ) : (
          <input
            id={wId}
            disabled
            placeholder={values.platform ? "None available" : "Choose a platform first"}
            className={input}
            aria-describedby={`${wId}-error`}
          />
        )}
      </Field>
    </>
  );
}
