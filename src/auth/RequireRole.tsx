import { Navigate, Outlet } from 'react-router-dom';

import type { UserRole } from '@/api/types';
import { useAuth } from '@/auth/context';

/**
 * Gates a route by role, mirroring the backend's role dependencies. Sits
 * inside `RequireAuth`, so `user` is set here.
 *
 * Redirects to `/` instead of showing an error: the backend rejects the
 * underlying request regardless, so this is UX, not enforcement.
 */
export function RequireRole({ roles }: { roles: readonly UserRole[] }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/**
 * Keeps a superadmin's platform-wide list pages off while they act as an empresa:
 * those lists would 403 and the empresa's own page is the right place instead.
 */
export function RequireNotActing({ to }: { to: (tenantId: string) => string }) {
  const { actingAsTenant } = useAuth();

  if (actingAsTenant) {
    return <Navigate to={to(actingAsTenant)} replace />;
  }

  return <Outlet />;
}
