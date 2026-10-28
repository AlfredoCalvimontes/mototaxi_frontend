import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';

import { addUsageCredit } from '@/api/admin';
import type { Driver } from '@/api/types';
import { Field, FormDialog } from '@/components/Field';
import { parseCredit } from '@/lib/dirty';
import { errorText } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { strings } from '@/lib/strings';
import { formatCredit } from '@/lib/usageCredit';

/** The note is what the driver's history shows for this change, so it is kept short and real. */
const NOTE_MIN = 3;
const NOTE_MAX = 500;

type Change = { amount: number; note: string };

/**
 * Adds usage credit to a driver; a negative amount takes some back, with a warning.
 *
 * Every submit carries a request id. Retrying the same change (after a network
 * failure, say) reuses the id, so the server adds the credit once. Changing the
 * amount or note gets a new id: the server refuses a reused id for a different
 * change.
 */
export function UsageCreditDialog({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const lastChange = useRef<(Change & { requestId: string }) | null>(null);

  const amount = parseCredit(text);
  const valid = amount !== null && Number.isFinite(amount) && amount !== 0;
  const negative = valid && amount < 0;
  const reason = note.trim();
  const noteValid = reason.length >= NOTE_MIN && reason.length <= NOTE_MAX;

  const save = useMutation({
    mutationFn: (change: Change & { requestId: string }) =>
      addUsageCredit(driver.driver_uuid, {
        amount: change.amount,
        note: change.note,
        client_request_id: change.requestId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: ['driver'] });
      void queryClient.invalidateQueries({ queryKey: ['credit-ledger'] });
      onClose();
    },
  });

  function requestIdFor(change: Change): string {
    const last = lastChange.current;
    if (last && last.amount === change.amount && last.note === change.note) {
      return last.requestId;
    }
    const requestId = crypto.randomUUID();
    lastChange.current = { ...change, requestId };
    return requestId;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid || !noteValid) return;
    const change = { amount, note: reason };
    save.mutate({ ...change, requestId: requestIdFor(change) });
  }

  const balance = formatCredit(driver.usage_credit_balance);

  return (
    <FormDialog title={strings.fleet.addCreditTitle(driver.name)} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className={`text-sm ${driver.usage_credit_expired ? 'text-red-700' : 'text-slate-600'}`}>
          {driver.usage_credit_expired
            ? strings.fleet.addCreditExpiredIntro(balance)
            : strings.fleet.addCreditIntro(balance, formatDateTime(driver.usage_credit_expires_at))}
        </p>

        <Field
          label={strings.fleet.addCreditAmount}
          value={text}
          onChange={setText}
          required
          hint={strings.fleet.addCreditAmountHint}
          error={submitted && !valid ? strings.fleet.addCreditAmountInvalid : undefined}
        />

        <Field
          label={strings.fleet.addCreditNote}
          value={note}
          onChange={setNote}
          required
          hint={strings.fleet.addCreditNoteHint}
          error={submitted && !noteValid ? strings.fleet.addCreditNoteInvalid : undefined}
        />

        {negative && (
          <p
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {strings.fleet.addCreditNegativeWarning}
          </p>
        )}

        {save.error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(save.error)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {strings.common.cancel}
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className={`rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
              negative ? 'bg-red-700 hover:bg-red-800' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {save.isPending
              ? strings.common.loading
              : negative
                ? strings.fleet.addCreditSubmitNegative
                : strings.fleet.addCreditSubmit}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
