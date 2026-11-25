import { useActingTenant } from '@/lib/useActingTenant';

/**
 * The name of the empresa the caller is working in: their own, or the one a
 * superadmin acts as. See `useActingTenant`.
 */
export function useActingTenantName(): string | null {
  return useActingTenant()?.name ?? null;
}
