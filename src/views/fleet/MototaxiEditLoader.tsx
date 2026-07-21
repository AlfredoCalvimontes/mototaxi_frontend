import { useQuery } from '@tanstack/react-query';

import { getMototaxi } from '@/api/admin';
import type { UUID } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { FormDialog } from '@/components/Field';
import { strings } from '@/lib/strings';
import { MototaxiForm } from '@/views/fleet/MototaxiForm';

/**
 * The list endpoint returns the map summary; the edit form needs the fuller
 * detail shape (brand, model, IMEI, notes). The two are asymmetric by design,
 * so the detail is fetched per row on demand — ten rows, so the extra request
 * costs nothing worth optimising.
 */
export function MototaxiEditLoader({ uuid, onClose }: { uuid: UUID; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['mototaxi', uuid],
    queryFn: () => getMototaxi(uuid),
  });

  if (detail.isPending) {
    return (
      <FormDialog title={strings.fleet.editMototaxi} onClose={onClose}>
        <p className="text-sm text-slate-500" role="status">
          {strings.common.loading}
        </p>
      </FormDialog>
    );
  }

  if (detail.isError) {
    return (
      <FormDialog title={strings.fleet.editMototaxi} onClose={onClose}>
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </FormDialog>
    );
  }

  return <MototaxiForm mototaxi={detail.data} onClose={onClose} />;
}
