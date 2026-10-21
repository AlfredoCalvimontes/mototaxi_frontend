import { useQuery } from '@tanstack/react-query';

import { listVehicleTypes } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { TripSummary, UUID } from '@/api/types';
import { EMPTY } from '@/lib/format';
import { strings } from '@/lib/strings';

/** Display names of the tenant's vehicle types, keyed by uuid. */
export function useVehicleTypeNames(): Map<UUID, string> {
  const types = useQuery({ queryKey: queryKeys.vehicleTypes, queryFn: () => listVehicleTypes() });
  return new Map((types.data ?? []).map((t) => [t.vehicle_type_uuid, t.display_name]));
}

/** Asked-for type, plus the one that came when it differs ("Taxi (llegó Mototaxi)"). */
export function tripTypeLabel(trip: TripSummary, names: Map<UUID, string>): string {
  const asked = trip.requested_vehicle_type_uuid
    ? (names.get(trip.requested_vehicle_type_uuid) ?? EMPTY)
    : strings.trips.anyType;
  const got = trip.vehicle_type_uuid ? names.get(trip.vehicle_type_uuid) : undefined;
  return got && trip.requested_vehicle_type_uuid !== trip.vehicle_type_uuid
    ? strings.trips.askedAndGot(asked, got)
    : asked;
}
