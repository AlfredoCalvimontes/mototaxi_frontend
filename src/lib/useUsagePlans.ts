import { useQuery } from '@tanstack/react-query';

import { listUsagePlans } from '@/api/admin';
import { queryKeys } from '@/api/queries';

/** The tenant's plans (archived ones too; callers filter). */
export function useUsagePlans() {
  return useQuery({ queryKey: queryKeys.usagePlans, queryFn: () => listUsagePlans() });
}
