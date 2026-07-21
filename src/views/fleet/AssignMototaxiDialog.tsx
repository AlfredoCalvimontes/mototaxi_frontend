import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { assignMototaxi, listMototaxis } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { Driver } from '@/api/types';
import { FormDialog } from '@/components/Field';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

/** Sent as `null` to detach; the field is required, so `{}` would be a 422. */
const DETACH = '';

export function AssignMototaxiDialog({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(driver.current_mototaxi_uuid ?? DETACH);

  const mototaxis = useQuery({ queryKey: queryKeys.mototaxis, queryFn: listMototaxis });

  const save = useMutation({
    mutationFn: () =>
      assignMototaxi(driver.driver_uuid, {
        mototaxi_uuid: selected === DETACH ? null : selected,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.mototaxis });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  // A vehicle already driven by someone else would be refused with a 409, so
  // it is not offered in the first place.
  const available = (mototaxis.data ?? []).filter(
    (unit) => unit.current_driver_uuid === null || unit.current_driver_uuid === driver.driver_uuid,
  );

  return (
    <FormDialog title={strings.fleet.assignMototaxiTitle(driver.name)} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="mototaxi" className="block text-sm font-medium text-slate-700">
            {strings.drivers.mototaxi}
          </label>
          <select
            id="mototaxi"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {/* Detaching is spelled out rather than reachable by clearing. */}
            <option value={DETACH}>{strings.fleet.detachMototaxi}</option>
            {available.map((unit) => (
              <option key={unit.mototaxi_uuid} value={unit.mototaxi_uuid}>
                {unit.plate_number}
              </option>
            ))}
          </select>
        </div>

        {driver.status === 'IN_TRIP' && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {strings.fleet.inTripBlocked}
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
            disabled={save.isPending || driver.status === 'IN_TRIP'}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {save.isPending ? strings.common.loading : strings.common.save}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
