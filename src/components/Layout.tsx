import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/context';
import { strings } from '@/lib/strings';

const navItems = [
  { to: '/', label: strings.nav.dashboard, end: true },
  { to: '/viajes', label: strings.nav.liveTrips, end: false },
  { to: '/mototaxis', label: strings.nav.mototaxis, end: false },
  { to: '/conductores', label: strings.nav.drivers, end: false },
  { to: '/historial', label: strings.nav.history, end: false },
  { to: '/clientes', label: strings.nav.customers, end: false },
  { to: '/configuracion', label: strings.nav.settings, end: false },
];

export function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
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
        <nav aria-label="Secciones" className="mx-auto max-w-7xl overflow-x-auto px-4">
          <ul className="flex gap-1 whitespace-nowrap">
            {navItems.map((item) => (
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

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
