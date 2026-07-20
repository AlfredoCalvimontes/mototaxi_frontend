import { strings } from '@/lib/strings';

/** Placeholder with the row count the real table is about to show. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="space-y-2 rounded-lg border border-slate-200 bg-white p-4"
      role="status"
      aria-label={strings.common.loading}
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-6 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      role="status"
      aria-label={strings.common.loading}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}
