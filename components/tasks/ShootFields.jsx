"use client";

// "นัดถ่าย" fields (round 48): วันที่ · เวลา (24 h, components/tasks/TimeField.jsx) ·
// สถานที่. Used by the Production / Photo Step 2 forms (optional group) and the
// "ตั้งวันถ่ายทำ / เลื่อนวันนัดถ่าย" dialog (required). Rules: lib/tasks/statusView.js parseShoot.

import { FieldError, input, label } from "@/components/projects/ProjectForm";
import TimeField from "@/components/tasks/TimeField";
import { SHOOT_LOCATION_MAX } from "@/lib/tasks/statusView";

/**
 * @param {{ id: string, values: { shootDate: string, shootTime: string, shootLocation: string },
 *           setField: (field: string, value: string) => void, errors?: Record<string, string>, required?: boolean }} props
 */
export default function ShootFields({ id, values, setField, errors = {}, required = false }) {
  const star = required ? <span className="text-danger" aria-hidden="true"> *</span> : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-date`} className={label}>วันที่{star}</label>
          <input
            id={`${id}-date`}
            type="date"
            value={values.shootDate}
            onChange={(e) => setField("shootDate", e.target.value)}
            className={input}
            aria-invalid={!!errors.shootDate || undefined}
            aria-describedby={`${id}-date-error`}
          />
          <FieldError id={`${id}-date-error`} error={errors.shootDate} />
        </div>
        <div>
          <label htmlFor={`${id}-time`} className={label}>เวลา{star}</label>
          <TimeField id={`${id}-time`} value={values.shootTime} onChange={(v) => setField("shootTime", v)} invalid={!!errors.shootTime} describedBy={`${id}-time-error`} />
          <FieldError id={`${id}-time-error`} error={errors.shootTime} />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-location`} className={label}>สถานที่{star}</label>
        <input
          id={`${id}-location`}
          maxLength={SHOOT_LOCATION_MAX}
          placeholder="เช่น Studio A"
          value={values.shootLocation}
          onChange={(e) => setField("shootLocation", e.target.value)}
          className={input}
          aria-invalid={!!errors.shootLocation || undefined}
          aria-describedby={`${id}-location-error`}
        />
        <FieldError id={`${id}-location-error`} error={errors.shootLocation} />
      </div>
    </div>
  );
}
