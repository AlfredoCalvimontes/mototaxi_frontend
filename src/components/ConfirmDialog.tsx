import { useEffect, useId, useRef, useState } from 'react';

import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Must name the specific trip or customer — never a generic warning. */
  body: string;
  confirmLabel?: string;
  /** Renders an optional free-text reason passed back to `onConfirm`. */
  reasonLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: unknown;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
};

/**
 * The body is a separate component mounted only while the dialog is open, so
 * the reason field starts empty on each open without an effect resetting it —
 * a stale reason carried into the next confirmation would be sent to the API.
 */
function ConfirmDialogBody({
  title,
  body,
  confirmLabel,
  reasonLabel,
  destructive,
  pending,
  error,
  onConfirm,
  onClose,
}: Omit<ConfirmDialogProps, 'open'>) {
  const titleId = useId();
  const [reason, setReason] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Escape must not abandon a request already in flight.
      if (event.key === 'Escape' && !pending) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-lg"
      >
        <h2 id={titleId} className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <p className="text-sm text-slate-600">{body}</p>

        {reasonLabel && (
          <div className="space-y-1">
            <label
              htmlFor={`${titleId}-reason`}
              className="block text-sm font-medium text-slate-700"
            >
              {reasonLabel}
            </label>
            <input
              id={`${titleId}-reason`}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        )}

        {error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(error)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {strings.common.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onConfirm(reason.trim() || undefined)}
            disabled={pending}
            className={`rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {pending ? strings.common.loading : (confirmLabel ?? strings.common.confirm)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  destructive = true,
  pending = false,
  ...rest
}: ConfirmDialogProps) {
  if (!open) return null;
  return <ConfirmDialogBody destructive={destructive} pending={pending} {...rest} />;
}
