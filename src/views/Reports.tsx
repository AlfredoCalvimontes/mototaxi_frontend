import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/context';
import { ADMIN, STAFF, SUPERADMIN } from '@/auth/roles';
import { strings } from '@/lib/strings';

/**
 * Every report in one place: trip history, driver credit, and the platform
 * view. Each tab shows only to the roles allowed to read it.
 */
export default function Reports() {
  const { user } = useAuth();
  const role = user?.role;
  const tabs = [
    { to: 'historial', label: strings.nav.history, visible: !!role && STAFF.includes(role) },
    { to: 'credito', label: strings.nav.creditHistory, visible: !!role && ADMIN.includes(role) },
    {
      to: 'plataforma',
      label: strings.nav.platform,
      visible: !!role && SUPERADMIN.includes(role),
    },
  ].filter((tab) => tab.visible);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{strings.reports.heading}</h1>
      <nav aria-label={strings.reports.heading} className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
