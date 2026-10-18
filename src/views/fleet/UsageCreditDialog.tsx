import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { addUsageCredit } from '@/api/admin';
import type { Driver } from '@/api/types';
import { Field, FormDialog } from '@/components/Field';
import { parseCredit } from '@/lib/dirty';
import { errorText } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { strings } from '@/lib/strings';
import { formatCredit } from '@/lib/usageCredit';

/** Adds usage credit to a driver; a negative amount takes some back, with a warning. */
export function UsageCreditDialog({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const amount = parseCredit(text);
  const valid = amount !== null && Number.isFinite(amount) && amount !== 0;
  const negative = valid && amount < 0;

  const save = useMutation({
    mutationFn: (value: number) => addUsageCredit(driver.driver_uuid, { amount: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: ['driver'] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    save.mutate(amount);
  }

  const balance = formatCredit(driver.usage_credit_balance);

  return (
    <FormDialog title={strings.fleet.addCreditTitle(driver.name)} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className={`text-sm ${driver.usage_credit_expired ? 'text-red-700' : 'text-slate-600'}`}>
          {driver.usage_credit_expired
            ? strings.fleet.addCreditExpiredIntro(balance)
            : strings.fleet.addCreditIntro(balance, formatDate(driver.usage_credit_expires_on))}
        </p>

        <Field
          label={strings.fleet.addCreditAmount}
          value={text}
          onChange={setText}
          required
          hint={strings.fleet.addCreditAmountHint}
          error={submitted && !valid ? strings.fleet.addCreditAmountInvalid : undefined}
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
