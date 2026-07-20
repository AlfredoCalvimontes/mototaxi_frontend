import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from '@/auth/RequireAuth';
import { Layout } from '@/components/Layout';
import Customers from '@/views/Customers';
import Dashboard from '@/views/Dashboard';
import Drivers from '@/views/Drivers';
import LiveTrips from '@/views/LiveTrips';
import Login from '@/views/Login';
import Mototaxis from '@/views/Mototaxis';
import TripHistory from '@/views/TripHistory';

function Placeholder({ name }: { name: string }) {
  return <p className="text-slate-500">{name}</p>;
}

/** Extracted from `App` so tests can mount the same tree under a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/viajes" element={<LiveTrips />} />
          <Route path="/mototaxis" element={<Mototaxis />} />
          <Route path="/conductores" element={<Drivers />} />
          <Route path="/historial" element={<TripHistory />} />
          <Route path="/clientes" element={<Customers />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
