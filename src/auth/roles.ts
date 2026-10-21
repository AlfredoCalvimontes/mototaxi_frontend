import type { UserRole } from '@/api/types';

/** Every panel user. `CUSTOMER` never signs in here (WhatsApp-only). */
export const STAFF: readonly UserRole[] = ['SUPERADMIN', 'TENANT_ADMIN', 'CITY_ADMIN', 'OPERATOR'];
/** Mirrors the backend `TenantAdminUser` gate. */
export const ADMIN: readonly UserRole[] = ['SUPERADMIN', 'TENANT_ADMIN'];
