import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider } from '@/auth/AuthProvider';

function testQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Retries turn a deliberate 500 fixture into a multi-second wait.
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export type RenderAppOptions = RenderOptions & {
  route?: string;
  withAuth?: boolean;
};

/** Renders inside the providers a view actually depends on at runtime. */
export function renderApp(ui: ReactElement, options: RenderAppOptions = {}) {
  const { route = '/', withAuth = true, ...rest } = options;
  const client = testQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    const routed = <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;
    return (
      <QueryClientProvider client={client}>
        {withAuth ? <AuthProvider>{routed}</AuthProvider> : routed}
      </QueryClientProvider>
    );
  }

  return {
    user: userEvent.setup(),
    queryClient: client,
    ...render(ui, { wrapper: Wrapper, ...rest }),
  };
}
