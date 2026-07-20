import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { expect, test } from 'vitest';

import App from '@/App';
import { server } from '@/test/server';

test('sin sesión, la aplicación completa aterriza en login', async () => {
  server.use(
    http.get('/api/v1/users/me', () =>
      HttpResponse.json({ detail: 'No autenticado' }, { status: 401 }),
    ),
  );

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Ingresar al panel' })).toBeInTheDocument();
});
