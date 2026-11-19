// Post "Status Asset" chip — DERIVED from its Related Assets (lib/tasks/assets.js),
// read-only. Used on task cards, the Content detail table and the Post Step 2.
// No hooks: renders from server and client components.

const TONE = {
  ready: "bg-success/15 text-success",
  partial: "bg-warning/15 text-warning",
  not_ready: "bg-danger/10 text-danger",
  not_needed: "bg-track text-fg-muted",
};

export default function AssetStatusChip({ status, label }) {
  if (!label) return null;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[status] ?? TONE.not_needed}`}>
      Asset: {label}
    </span>
  );
}
