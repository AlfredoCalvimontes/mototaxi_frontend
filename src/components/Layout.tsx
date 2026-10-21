import { NavLink, Outlet } from 'react-router-dom';

import type { UserRole } from '@/api/types';
import { useAuth } from '@/auth/context';
import { ADMIN } from '@/auth/roles';
import { strings } from '@/lib/strings';

type NavItem = { to: string; label: string; end: boolean; roles?: readonly UserRole[] };

const navItems: NavItem[] = [
  { to: '/', label: strings.nav.dashboard, end: true },
  { to: '/viajes', label: strings.nav.liveTrips, end: false },
  { to: '/mototaxis', label: strings.nav.vehicles, end: false },
  { to: '/conductores', label: strings.nav.drivers, end: false },
  { to: '/historial', label: strings.nav.history, end: false },
  { to: '/clientes', label: strings.nav.customers, end: false },
  { to: '/configuracion', label: strings.nav.settings, end: false, roles: ADMIN },
];

export function Layout() {
  const { user, signOut, actingAsTenant, setActingAsTenant } = useAuth();
  const visibleItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <div className="min-h-screen">
      {actingAsTenant && (
        // Persistent and non-dismissable: the only way out is to stop acting.
        <div
          role="status"
          className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-1 text-sm text-amber-900"
        >
          <span>{strings.tenancy.actingAs(actingAsTenant)}</span>
          <button
            type="button"
            onClick={() => setActingAsTenant(null)}
            className="font-medium underline"
          >
            {strings.tenancy.stopActingAs}
          </button>
        </div>
      )}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{strings.app.title}</p>
            <p className="text-xs text-slate-500">{strings.app.city}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {user?.name && <span className="text-slate-600">{user.name}</span>}
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50"
            >
              {strings.nav.logout}
            </button>
          </div>
        </div>
        {/* Scrolls horizontally rather than wrapping into a tall stack on a phone. */}
        <nav aria-label="Secciones" className="mx-auto max-w-[1800px] overflow-x-auto px-4">
          <ul className="flex gap-1 whitespace-nowrap">
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-block border-b-2 px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-[1800px] space-y-6 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
