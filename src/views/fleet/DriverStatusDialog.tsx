import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { changeDriverStatus } from '@/api/admin';
import type { Driver, DriverStatus } from '@/api/types';
import { FormDialog } from '@/components/Field';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const STATUSES: DriverStatus[] = ['AVAILABLE', 'RESTING', 'OFFLINE', 'DISABLED'];

/**
 * `IN_TRIP` is absent on purpose: it is a consequence of dispatch, not
 * something an administrator sets. This dialog is also the only route out of
 * `DISABLED` — the delete endpoint retires a driver, this restores them.
 */
export function DriverStatusDialog({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DriverStatus>(
    driver.status === 'IN_TRIP' ? 'AVAILABLE' : driver.status,
  );
  const [restingUntil, setRestingUntil] = useState('');
  const [reason, setReason] = useState('');

  const save = useMutation({
    mutationFn: () =>
      changeDriverStatus(driver.driver_uuid, {
        status,
        reason: reason.trim() || null,
        // The API returns 422 if this is sent with any other status, so it is
        // only ever attached to a rest.
        resting_until:
          status === 'RESTING' && restingUntil ? new Date(restingUntil).toISOString() : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <FormDialog title={strings.fleet.changeStatusTitle(driver.name)} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">{strings.drivers.status}</legend>
          {STATUSES.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value={option}
                checked={status === option}
                onChange={() => setStatus(option)}
              />
              {strings.status.driver[option]}
            </label>
          ))}
        </fieldset>

        {/* Only offered for a rest, so nobody expects an automatic return that
            the API would have rejected anyway. */}
        {status === 'RESTING' && (
          <div className="space-y-1">
            <label htmlFor="resting-until" className="block text-sm font-medium text-slate-700">
              {strings.fleet.restingUntilLabel}
            </label>
            <input
              id="resting-until"
              type="datetime-local"
              value={restingUntil}
              onChange={(e) => setRestingUntil(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500">{strings.fleet.restingUntilHint}</p>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="status-reason" className="block text-sm font-medium text-slate-700">
            {strings.fleet.statusReason}
          </label>
          <input
            id="status-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

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
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {save.isPending ? strings.common.loading : strings.common.save}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
