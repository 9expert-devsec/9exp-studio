import { card } from "./styles";

export default function TableSkeleton() {
  return (
    <div className={`${card} animate-pulse p-4`} aria-hidden="true">
      <div className="mb-4 h-11 w-full max-w-sm rounded-lg bg-slate-200 dark:bg-white/10" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-10 rounded bg-slate-200 dark:bg-white/10" />
        ))}
      </div>
    </div>
  );
}
