// Suspense fallbacks for the project pages.

export function FormSkeleton() {
  return <div className="mx-auto h-[720px] w-full max-w-[880px] animate-pulse rounded-[24px] bg-track" aria-hidden="true" />;
}

/** Breadcrumb + header card + tabs (the (tabs) layout). */
export function ProjectHeaderSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <span className="h-3 w-48 rounded bg-track" />
      <span className="h-56 rounded-[24px] bg-track" />
      <span className="h-11 w-72 rounded bg-track" />
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-3" aria-hidden="true">
      <span className="h-72 rounded-[24px] bg-track lg:col-span-2" />
      <span className="h-72 rounded-[24px] bg-track" />
    </div>
  );
}

export function ContentListSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <span className="h-12 w-72 rounded bg-track" />
      {[0, 1].map((i) => (
        <span key={i} className="h-64 rounded-[16px] bg-track" />
      ))}
    </div>
  );
}

export function ContentFormSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <span className="h-12 w-72 rounded bg-track" />
      <span className="h-[460px] rounded-[24px] bg-track" />
    </div>
  );
}
