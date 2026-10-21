import { useQuery } from '@tanstack/react-query';

import { getVehicle } from '@/api/admin';
import type { UUID } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { FormDialog } from '@/components/Field';
import { strings } from '@/lib/strings';
import { VehicleForm } from '@/views/fleet/VehicleForm';

/**
 * The list endpoint returns the map summary; the edit form needs the fuller
 * detail shape (brand, model, IMEI, notes). The two are asymmetric by design,
 * so the detail is fetched per row on demand — ten rows, so the extra request
 * costs nothing worth optimising.
 */
export function VehicleEditLoader({ uuid, onClose }: { uuid: UUID; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['vehicle', uuid],
    queryFn: () => getVehicle(uuid),
  });

  if (detail.isPending) {
    return (
      <FormDialog title={strings.fleet.editVehicle} onClose={onClose}>
        <p className="text-sm text-slate-500" role="status">
          {strings.common.loading}
        </p>
      </FormDialog>
    );
  }

  if (detail.isError) {
    return (
      <FormDialog title={strings.fleet.editVehicle} onClose={onClose}>
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </FormDialog>
    );
  }

  return <VehicleForm vehicle={detail.data} onClose={onClose} />;
}
