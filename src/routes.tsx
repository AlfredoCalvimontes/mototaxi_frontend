import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { RequireAuth } from '@/auth/RequireAuth';
import { RequireNotActing, RequireRole } from '@/auth/RequireRole';
import { ADMIN, CITY_SCOPED, STAFF, SUPERADMIN } from '@/auth/roles';
import { Layout } from '@/components/Layout';
import Customers from '@/views/Customers';
import Dashboard from '@/views/Dashboard';
import CreditHistory from '@/views/CreditHistory';
import Drivers from '@/views/Drivers';
import LiveTrips from '@/views/LiveTrips';
import Login from '@/views/Login';
import Vehicles from '@/views/Vehicles';
import CityAccessManager from '@/views/tenancy/CityAccessManager';
import Cities from '@/views/tenancy/Cities';
import CityDetail from '@/views/tenancy/CityDetail';
import TenantDetail from '@/views/tenancy/TenantDetail';
import Platform from '@/views/tenancy/Platform';
import Reports from '@/views/Reports';
import WhatsApp from '@/views/tenancy/WhatsApp';
import AllCities from '@/views/tenancy/AllCities';
import Tenants from '@/views/tenancy/Tenants';
import UsagePlans from '@/views/tenancy/UsagePlans';
import VehicleTypes from '@/views/tenancy/VehicleTypes';
import Settings from '@/views/Settings';
import TripHistory from '@/views/TripHistory';

/** Old bookmarks and alert links used `/mototaxis`; keep the query string. */
function LegacyVehicles({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

/** Extracted from `App` so tests can mount the same tree under a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route element={<RequireRole roles={STAFF} />}>
            <Route index element={<Dashboard />} />
            <Route path="/viajes" element={<LiveTrips />} />
            <Route path="/vehiculos" element={<Vehicles />} />
            <Route path="/mototaxis" element={<LegacyVehicles to="/vehiculos" />} />
            <Route path="/mototaxis/tipos" element={<LegacyVehicles to="/vehiculos/tipos" />} />
            <Route path="/conductores" element={<Drivers />} />
            <Route path="/historial" element={<TripHistory />} />
            <Route path="/clientes" element={<Customers />} />
            <Route path="/reportes" element={<Reports />}>
              <Route index element={<Navigate to="historial" replace />} />
              <Route path="historial" element={<TripHistory />} />
              <Route element={<RequireRole roles={ADMIN} />}>
                <Route path="credito" element={<CreditHistory />} />
              </Route>
              <Route element={<RequireRole roles={SUPERADMIN} />}>
                <Route path="plataforma" element={<Platform />} />
              </Route>
            </Route>
          </Route>
          <Route element={<RequireRole roles={ADMIN} />}>
            <Route path="/configuracion" element={<Settings />} />
            <Route path="/vehiculos/tipos" element={<VehicleTypes />} />
            <Route path="/planes" element={<UsagePlans />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            {/* Routing and the company's numbers are one screen now. */}
            <Route path="/rutas-whatsapp" element={<Navigate to="/whatsapp" replace />} />
            <Route path="/historial-credito" element={<CreditHistory />} />
            <Route path="/tenants/:tenantId" element={<TenantDetail />} />
            <Route
              path="/tenants/:tenantId/cities/:cityId/access"
              element={<CityAccessManager />}
            />
          </Route>
          <Route element={<RequireRole roles={SUPERADMIN} />}>
            <Route element={<RequireNotActing to={() => '/'} />}>
              <Route path="/tenants" element={<Tenants />} />
            </Route>
            <Route element={<RequireNotActing to={(id) => `/tenants/${id}/cities`} />}>
              <Route path="/cities" element={<AllCities />} />
            </Route>
            <Route path="/cities/:cityId" element={<CityDetail />} />
            <Route path="/cities/:cityId/access" element={<CityAccessManager />} />
            <Route path="/plataforma" element={<Platform />} />
          </Route>
          <Route element={<RequireRole roles={CITY_SCOPED} />}>
            <Route path="/tenants/:tenantId/cities" element={<Cities />} />
            <Route path="/tenants/:tenantId/cities/:cityId" element={<CityDetail />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
