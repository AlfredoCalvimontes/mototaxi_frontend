import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { moveDriverToCity, moveVehicleToCity } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import { FormDialog, SelectField } from '@/components/Field';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';
import { useCities } from '@/lib/useCities';

/**
 * Moves a driver or a vehicle to another city. A deliberate action of its own:
 * the server unpairs the two (they cannot span cities) and refuses while the
 * driver is on a trip, so the choice is made explicit here.
 */
export function MoveToCityDialog({
  kind,
  uuid,
  label,
  currentCityUuid,
  onClose,
}: {
  kind: 'driver' | 'vehicle';
  uuid: string;
  label: string;
  currentCityUuid: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { cities } = useCities();
  const [target, setTarget] = useState('');

  const options = cities.filter((c) => c.is_active && c.city_id !== currentCityUuid);

  const move = useMutation({
    mutationFn: async () => {
      if (kind === 'driver') await moveDriverToCity(uuid, { city_uuid: target });
      else await moveVehicleToCity(uuid, { city_uuid: target });
    },
    onSuccess: () => {
      // Both lists change: the pair is separated on the way.
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      void queryClient.invalidateQueries({ queryKey: ['vehicle'] });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (target) move.mutate();
  }

  return (
    <FormDialog title={strings.tenancy.moveToCityTitle(label)} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <SelectField
          label={strings.tenancy.cityFieldLabel}
          value={target}
          onChange={setTarget}
          options={[
            { value: '', label: '—' },
            ...options.map((c) => ({ value: c.city_id, label: c.name })),
          ]}
          hint={strings.tenancy.moveToCityHint}
        />
        {move.error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(move.error)}
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
            disabled={!target || move.isPending}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {strings.tenancy.moveToCity}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
