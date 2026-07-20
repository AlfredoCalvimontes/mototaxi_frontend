import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{errorText(error)}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-red-300 bg-white px-3 py-1 font-medium text-red-800 hover:bg-red-100"
        >
          {strings.common.retry}
        </button>
      )}
    </div>
  );
}
