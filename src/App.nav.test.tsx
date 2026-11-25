import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { expect, test } from 'vitest';

import App from '@/App';
import * as fx from '@/test/fixtures';
import { server } from '@/test/server';

const BASE = '/api/v1';

test('el menú Usuarios abre la página de usuarios, no vuelve al inicio', async () => {
  server.use(
    http.get(`${BASE}/users/me`, () => HttpResponse.json(fx.superadminProfile)),
    http.get(`${BASE}/admin/staff-users`, () => HttpResponse.json([])),
  );
  window.history.pushState({}, '', '/');
  render(<App />);

  await userEvent.click(await screen.findByRole('link', { name: 'Usuarios' }));

  await waitFor(() => expect(window.location.pathname).toBe('/usuarios'));
  expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
});
