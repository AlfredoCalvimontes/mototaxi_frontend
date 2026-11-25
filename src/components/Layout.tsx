import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/context';
import { CitySelector } from '@/components/CitySelector';
import { TenantSwitcher } from '@/components/TenantSwitcher';
import { navItemsFor } from '@/lib/nav';
import { strings } from '@/lib/strings';
import { useActingTenantName } from '@/lib/useActingTenantName';

export function Layout() {
  const { user, signOut, actingAsTenant, setActingAsTenant } = useAuth();
  const visibleItems = navItemsFor(user, actingAsTenant);
  const actingName = useActingTenantName();

  return (
    <div className="min-h-screen">
      {actingAsTenant && (
        // Persistent and non-dismissable: the only way out is to stop acting.
        <div
          role="status"
          className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-1 text-sm text-amber-900"
        >
          <span>{strings.tenancy.actingAs(actingName ?? '…')}</span>
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
            {/* Acting as a business, the business is the context: no picker. */}
            {!actingAsTenant && <TenantSwitcher />}
            <CitySelector />
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
