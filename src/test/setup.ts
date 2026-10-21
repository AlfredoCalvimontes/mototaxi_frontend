import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from '@/test/server';

// The default 1s for findBy*/waitFor is tight once most views also fetch cities
// and tenants; a loaded CI box or dev machine flakes on it. Assertions are unchanged.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no scrollTo, and Leaflet calls it when a popup opens. Left alone it
// prints "Not implemented" for every map test, which buries real output.
vi.stubGlobal('scrollTo', vi.fn());

// Unhandled requests are an error: a view that quietly hits an endpoint the
// contract does not define should fail the suite, not fall through to network.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
