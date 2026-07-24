export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl border border-border bg-paper-raised ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between p-4">
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-border" />
          <div className="h-3 w-64 rounded bg-border" />
        </div>
        <div className="h-6 w-24 rounded-full bg-border" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-6 grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
