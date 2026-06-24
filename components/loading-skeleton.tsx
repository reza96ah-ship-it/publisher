type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <span className={`block animate-pulse rounded bg-slate-200/80 ${className}`} aria-hidden="true" />;
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-app-border" aria-label="در حال دریافت اطلاعات">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_120px]">
          <div className="space-y-2">
            <Skeleton className="h-3 w-40 max-w-full" />
            <Skeleton className="h-2.5 w-64 max-w-full" />
          </div>
          <Skeleton className="h-3 w-28 max-w-full" />
          <Skeleton className="h-7 w-20 max-w-full" />
        </div>
      ))}
    </div>
  );
}

export function LoadingPanel() {
  return (
    <div className="space-y-4" aria-label="در حال دریافت اطلاعات">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
