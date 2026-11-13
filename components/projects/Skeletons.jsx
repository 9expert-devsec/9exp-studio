// Suspense fallbacks for the project pages.

export function FormSkeleton() {
  return <div className="mx-auto h-[720px] w-full max-w-[880px] animate-pulse rounded-[24px] bg-track" aria-hidden="true" />;
}

export function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden="true">
      <span className="h-3 w-40 rounded bg-track" />
      <span className="h-56 rounded-[24px] bg-track" />
      <div className="grid gap-6 lg:grid-cols-3">
        <span className="h-72 rounded-[24px] bg-track lg:col-span-2" />
        <span className="h-72 rounded-[24px] bg-track" />
      </div>
    </div>
  );
}
