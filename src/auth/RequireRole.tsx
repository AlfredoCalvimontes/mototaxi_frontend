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
