import { card } from "./styles";

export default function TableSkeleton() {
  return (
    <div className={`${card} animate-pulse p-4`} aria-hidden="true">
      <div className="mb-4 h-11 w-full max-w-sm rounded-[10px] bg-track" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-10 rounded bg-track" />
        ))}
      </div>
    </div>
  );
}
