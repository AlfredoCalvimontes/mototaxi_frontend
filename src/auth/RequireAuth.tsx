import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/context';
import { strings } from '@/lib/strings';

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500" role="status">
        {strings.session.checking}
      </div>
    );
  }

  if (status === 'anonymous') {
    // `state.from` lets the login screen send the operator back where they were
    // rather than always to the dashboard.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
