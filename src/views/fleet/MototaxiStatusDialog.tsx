import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { changeMototaxiStatus } from '@/api/admin';
import type { MototaxiStatus, MototaxiSummary } from '@/api/types';
import { FormDialog } from '@/components/Field';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const STATUSES: MototaxiStatus[] = ['AVAILABLE', 'OUT_OF_SERVICE', 'DISABLED'];

/**
 * The vehicle's own condition — mechanical or administrative. Dispatch
 * eligibility comes from the driver's status; these are joined, not mirrored
 * (spec §4.2).
 */
export function MototaxiStatusDialog({
  mototaxi,
  onClose,
}: {
  mototaxi: MototaxiSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MototaxiStatus>(mototaxi.status as MototaxiStatus);

  const save = useMutation({
    mutationFn: () => changeMototaxiStatus(mototaxi.mototaxi_uuid, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mototaxis'] });
      void queryClient.invalidateQueries({ queryKey: ['mototaxi'] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <FormDialog
      title={`${strings.fleet.vehicleStatus}: ${mototaxi.plate_number}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">{strings.mototaxis.status}</legend>
          {STATUSES.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mototaxi-status"
                value={option}
                checked={status === option}
                onChange={() => setStatus(option)}
              />
              {strings.status.mototaxi[option]}
            </label>
          ))}
        </fieldset>

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
