import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from '@/auth/RequireAuth';
import { Layout } from '@/components/Layout';
import Dashboard from '@/views/Dashboard';
import Drivers from '@/views/Drivers';
import Login from '@/views/Login';
import Mototaxis from '@/views/Mototaxis';

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
          <Route path="/viajes" element={<Placeholder name="Viajes en curso" />} />
          <Route path="/mototaxis" element={<Mototaxis />} />
          <Route path="/conductores" element={<Drivers />} />
          <Route path="/historial" element={<Placeholder name="Historial" />} />
          <Route path="/clientes" element={<Placeholder name="Clientes" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
