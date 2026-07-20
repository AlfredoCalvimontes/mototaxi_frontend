import { strings } from '@/lib/strings';

export function EmptyState({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
      {message ?? strings.common.empty}
    </div>
  );
}
