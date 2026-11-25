import { useAuth } from '@/auth/context';
import { useQuery } from '@tanstack/react-query';

import { listUsagePlans } from '@/api/admin';
import { queryKeys } from '@/api/queries';

/** The tenant's plans (archived ones too; callers filter). */
export function useUsagePlans() {
  // Plans belong to one empresa, so the key follows the acted-as one.
  const { actingAsTenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.usagePlans, actingAsTenant],
    queryFn: () => listUsagePlans(),
  });
}
