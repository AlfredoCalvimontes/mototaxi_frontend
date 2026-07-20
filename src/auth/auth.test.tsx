import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test } from 'vitest';

import { request, resetAuthRefreshState } from '@/api/client';
import { RequireAuth } from '@/auth/RequireAuth';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Login from '@/views/Login';

const BASE = '/api/v1';

/** No session: `GET /users/me` is what decides, since cookies are httpOnly. */
function anonymous() {
  server.use(
    http.get(`${BASE}/users/me`, () =>
      HttpResponse.json({ detail: 'No autenticado' }, { status: 401 }),
    ),
  );
}

function routes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<h1>Resumen</h1>} />
      </Route>
    </Routes>
  );
}

beforeEach(() => resetAuthRefreshState());

describe('inicio de sesión', () => {
  test('credenciales correctas llevan al panel', async () => {
    anonymous();
    const { user } = renderApp(routes(), { route: '/login' });

    await user.type(await screen.findByLabelText('Correo'), 'admin@mototaxis.bo');
    await user.type(screen.getByLabelText('Contraseña'), 'correcta');

    // Once signed in, the profile call must succeed for the session to open.
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json({ user_uuid: 'u1', name: 'Ana' })),
    );
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
  });

  test('credenciales incorrectas muestran el error y limpian la contraseña', async () => {
    anonymous();
    const { user } = renderApp(routes(), { route: '/login' });

    await user.type(await screen.findByLabelText('Correo'), 'admin@mototaxis.bo');
    const password = screen.getByLabelText('Contraseña');
    await user.type(password, 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(password).toHaveValue('');
    expect(screen.queryByRole('heading', { name: 'Resumen' })).not.toBeInTheDocument();
  });

  test('el límite de intentos se explica en lugar de fallar en genérico', async () => {
    anonymous();
    server.use(
      http.post(`${BASE}/users/login`, () =>
        HttpResponse.json({ detail: 'Too Many Requests' }, { status: 429 }),
      ),
    );
    const { user } = renderApp(routes(), { route: '/login' });

    await user.type(await screen.findByLabelText('Correo'), 'admin@mototaxis.bo');
    await user.type(screen.getByLabelText('Contraseña'), 'correcta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Demasiados intentos/);
  });

  test('no envía la petición si falta un campo', async () => {
    anonymous();
    let loginCalls = 0;
    server.use(
      http.post(`${BASE}/users/login`, () => {
        loginCalls += 1;
        return HttpResponse.json({ detail: 'no' }, { status: 401 });
      }),
    );
    const { user } = renderApp(routes(), { route: '/login' });

    await user.type(await screen.findByLabelText('Correo'), 'admin@mototaxis.bo');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Completa ambos campos');
    expect(loginCalls).toBe(0);
  });
});

describe('rutas protegidas', () => {
  test('una sesión válida sobrevive a recargar la página', async () => {
    // Default handlers already answer /users/me with a profile.
    renderApp(routes(), { route: '/' });
    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
  });

  test('sin sesión redirige a login', async () => {
    anonymous();
    renderApp(routes(), { route: '/' });
    expect(await screen.findByRole('heading', { name: 'Ingresar al panel' })).toBeInTheDocument();
  });

  test('no redirige mientras verifica la sesión', async () => {
    renderApp(routes(), { route: '/' });
    // The check is in flight: neither view has been decided yet.
    expect(screen.getByRole('status')).toHaveTextContent('Verificando sesión…');
    expect(screen.queryByRole('heading', { name: 'Ingresar al panel' })).not.toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Resumen' });
  });

  test('una sesión expirada devuelve a login con aviso', async () => {
    function Probe() {
      useEffect(() => {
        void request('/admin/kpis').catch(() => undefined);
      }, []);
      return <h1>Resumen</h1>;
    }

    server.use(
      http.get(`${BASE}/admin/kpis`, () =>
        HttpResponse.json({ detail: 'expirado' }, { status: 401 }),
      ),
      http.post(`${BASE}/users/refresh`, () =>
        HttpResponse.json({ detail: 'inválido' }, { status: 401 }),
      ),
    );

    renderApp(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Probe />} />
        </Route>
      </Routes>,
      { route: '/' },
    );

    await screen.findByRole('heading', { name: 'Resumen' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Ingresar al panel' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Tu sesión expiró. Ingresa de nuevo.')).toBeInTheDocument();
  });
});
